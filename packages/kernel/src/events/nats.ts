import type { EventDef, EventEnvelope, EventPayload } from '@kernaio/contracts'
import {
  AckPolicy,
  connect,
  DeliverPolicy,
  type JetStreamClient,
  type JetStreamManager,
  type NatsConnection,
  RetentionPolicy,
  StorageType,
  StringCodec,
} from 'nats'
import type { Logger } from '../logger.js'
import {
  type EventBus,
  InMemoryEventBus,
  makeEnvelope,
  type PublishOptions,
  type Unsubscribe,
} from './bus.js'

const sc = StringCodec()
export const STREAM = 'KERN_EVENTS'
/** subject layout: kern.evt.<module>.<entity>.<action> */
export const subjectFor = (name: string) => `kern.evt.${name}`
const patternToSubject = (pattern: string) =>
  pattern === '*'
    ? 'kern.evt.>'
    : pattern.endsWith('.*')
      ? `kern.evt.${pattern.slice(0, -2)}.>`
      : subjectFor(pattern)

export interface NatsBusOptions {
  url: string
  service: string
  log: Logger
}

/**
 * NATS JetStream event bus. Every event is persisted in the KERN_EVENTS stream (7 days / 2 GB default);
 * durable subscriptions are named `<service>-<module>-<hash>` so each service gets at-least-once delivery.
 */
export class NatsEventBus implements EventBus {
  private nc!: NatsConnection
  private js!: JetStreamClient
  private jsm!: JetStreamManager
  private subs: Unsubscribe[] = []
  private constructor(private readonly opts: NatsBusOptions) {}

  static async connect(opts: NatsBusOptions) {
    const bus = new NatsEventBus(opts)
    bus.nc = await connect({
      servers: opts.url,
      name: `kern-${opts.service}`,
      reconnect: true,
      maxReconnectAttempts: -1,
    })
    bus.js = bus.nc.jetstream()
    bus.jsm = await bus.nc.jetstreamManager()
    await bus.ensureStream()
    opts.log.info({ url: opts.url }, 'nats connected')
    return bus
  }
  private async ensureStream() {
    try {
      await this.jsm.streams.info(STREAM)
    } catch {
      await this.jsm.streams.add({
        name: STREAM,
        subjects: ['kern.evt.>'],
        retention: RetentionPolicy.Limits,
        storage: StorageType.File,
        max_age: 7 * 24 * 3600 * 1e9,
        max_bytes: 2 * 1024 ** 3,
        duplicate_window: 2 * 60 * 1e9,
      })
    }
  }
  get connection() {
    return this.nc
  }

  async publish<E extends EventDef>(def: E, payload: EventPayload<E>, opts?: PublishOptions) {
    await this.publishRaw(makeEnvelope(def, payload, opts))
  }
  async publishRaw(event: EventEnvelope) {
    await this.js.publish(subjectFor(event.name), sc.encode(JSON.stringify(event)), { msgID: event.id })
  }
  /**
   * Idempotently creates the durable pull consumer. Tolerates concurrent replicas racing to create it
   * and replaces a consumer left over from an older release whose config is no longer compatible
   * (for example a push consumer bound to a delivery subject).
   */
  private async ensureConsumer(durable: string, subject: string) {
    const config = {
      durable_name: durable,
      filter_subject: subject,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      ack_wait: 30 * 1e9,
      max_ack_pending: 256,
      max_deliver: 10,
    }
    const existing = await this.jsm.consumers.info(STREAM, durable).catch(() => null)
    if (existing) {
      const incompatible =
        Boolean(existing.config.deliver_subject) || existing.config.filter_subject !== subject
      if (!incompatible) return
      this.opts.log.warn({ durable }, 'replacing incompatible jetstream consumer')
      await this.jsm.consumers.delete(STREAM, durable).catch(() => {})
    }
    try {
      await this.jsm.consumers.add(STREAM, config)
    } catch (err) {
      // another replica created it first
      if (!String(err).includes('already exists')) throw err
    }
  }

  /**
   * Durable, at-least-once subscription. Uses a pull consumer so that several replicas of the same
   * service share one durable and load-balance its events; a push consumer would reject the second
   * replica ("duplicate subscription") because each would bind its own delivery inbox.
   */
  async subscribe(
    pattern: string,
    handler: (e: EventEnvelope) => Promise<void> | void,
    opts: { durable?: string } = {},
  ) {
    const subject = patternToSubject(pattern)
    const durable = (opts.durable ?? `${this.opts.service}-${pattern}`).replace(/[^a-zA-Z0-9_-]/g, '_')
    await this.ensureConsumer(durable, subject)
    const consumer = await this.js.consumers.get(STREAM, durable)
    const messages = await consumer.consume()
    ;(async () => {
      for await (const m of messages) {
        let event: EventEnvelope
        try {
          event = JSON.parse(sc.decode(m.data))
        } catch {
          m.term()
          continue
        }
        try {
          await handler(event)
          m.ack()
        } catch (err) {
          this.opts.log.error({ err, event: event.name, durable }, 'event handler failed; nak')
          m.nak(Math.min(60_000, 1000 * 2 ** Math.min(10, m.info.redeliveryCount)))
        }
      }
    })().catch((err) => this.opts.log.error({ err, durable }, 'subscription loop ended'))
    const unsub = () => {
      messages.stop()
    }
    this.subs.push(unsub)
    return unsub
  }

  async close() {
    for (const u of this.subs) u()
    await this.nc.drain()
  }
}

export async function createEventBus(opts: {
  url?: string
  service: string
  log: Logger
}): Promise<EventBus> {
  if (!opts.url) {
    opts.log.warn('NATS_URL not set – using in-memory event bus (single process only)')
    return new InMemoryEventBus(opts.log)
  }
  return NatsEventBus.connect({ url: opts.url, service: opts.service, log: opts.log })
}
export { AckPolicy, DeliverPolicy }
