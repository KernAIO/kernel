import type { EventDef, EventEnvelope, EventPayload } from '@kernalo/contracts'
import {
  AckPolicy,
  connect,
  consumerOpts,
  createInbox,
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
  log: Logger /** also deliver locally without round-trip (default true) */
  local?: boolean
}

/**
 * NATS JetStream event bus. Every event is persisted in the KERN_EVENTS stream (7 days / 2 GB default);
 * durable subscriptions are named `<service>-<module>-<hash>` so each service gets at-least-once delivery.
 */
export class NatsEventBus implements EventBus {
  private nc!: NatsConnection
  private js!: JetStreamClient
  private jsm!: JetStreamManager
  private readonly local: InMemoryEventBus
  private subs: Unsubscribe[] = []
  private constructor(private readonly opts: NatsBusOptions) {
    this.local = new InMemoryEventBus(opts.log)
  }

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
  async subscribe(
    pattern: string,
    handler: (e: EventEnvelope) => Promise<void> | void,
    opts: { durable?: string } = {},
  ) {
    const subject = patternToSubject(pattern)
    const durable = (opts.durable ?? `${this.opts.service}-${pattern}`).replace(/[^a-zA-Z0-9_-]/g, '_')
    const o = consumerOpts()
    o.durable(durable)
    o.manualAck()
    o.ackExplicit()
    o.deliverTo(createInbox())
    o.deliverAll()
    o.ackWait(30_000)
    o.maxAckPending(256)
    o.filterSubject(subject)
    const sub = await this.js.subscribe(subject, o)
    ;(async () => {
      for await (const m of sub) {
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
      sub.unsubscribe()
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
