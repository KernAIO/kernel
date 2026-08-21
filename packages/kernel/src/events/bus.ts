import { randomUUID } from 'node:crypto'
import type { EventDef, EventEnvelope, EventPayload } from '@kernalo/contracts'
import type { Logger } from '../logger.js'

export type Unsubscribe = () => void
export interface PublishOptions {
  workspaceId?: string | null
  actorId?: string | null
  traceId?: string
}

export interface EventBus {
  publish<E extends EventDef>(def: E, payload: EventPayload<E>, opts?: PublishOptions): Promise<void>
  publishRaw(event: EventEnvelope): Promise<void>
  /** pattern: exact name, `module.*`, or `*` */
  subscribe(
    pattern: string,
    handler: (event: EventEnvelope) => Promise<void> | void,
    opts?: { durable?: string },
  ): Promise<Unsubscribe>
  close(): Promise<void>
}

export function makeEnvelope<E extends EventDef>(
  def: E,
  payload: EventPayload<E>,
  opts: PublishOptions = {},
): EventEnvelope {
  def.schema.parse(payload)
  return {
    id: uuidv7(),
    name: def.name,
    version: def.version,
    module: def.module,
    workspaceId: (opts.workspaceId ?? null) as EventEnvelope['workspaceId'],
    actorId: (opts.actorId ?? null) as EventEnvelope['actorId'],
    occurredAt: new Date().toISOString(),
    traceId: opts.traceId,
    payload,
  }
}

export function matches(pattern: string, name: string): boolean {
  if (pattern === '*' || pattern === name) return true
  if (pattern.endsWith('.*')) return name.startsWith(pattern.slice(0, -1))
  if (pattern.endsWith('.>')) return name.startsWith(pattern.slice(0, -1))
  return false
}

/** In-process bus: used in tests and for local delivery inside one service. */
export class InMemoryEventBus implements EventBus {
  private subs: Array<{ pattern: string; handler: (e: EventEnvelope) => Promise<void> | void }> = []
  constructor(private readonly log?: Logger) {}
  async publish<E extends EventDef>(def: E, payload: EventPayload<E>, opts?: PublishOptions) {
    await this.publishRaw(makeEnvelope(def, payload, opts))
  }
  async publishRaw(event: EventEnvelope) {
    for (const s of this.subs) {
      if (!matches(s.pattern, event.name)) continue
      try {
        await s.handler(event)
      } catch (err) {
        this.log?.error({ err, event: event.name }, 'event handler failed')
      }
    }
  }
  async subscribe(pattern: string, handler: (e: EventEnvelope) => Promise<void> | void) {
    const entry = { pattern, handler }
    this.subs.push(entry)
    return () => {
      this.subs = this.subs.filter((s) => s !== entry)
    }
  }
  async close() {
    this.subs = []
  }
}

/** UUID v7 (time-ordered) – same layout Postgres 18 `uuidv7()` produces. */
export function uuidv7(): string {
  const now = BigInt(Date.now())
  const bytes = new Uint8Array(16)
  bytes[0] = Number((now >> 40n) & 0xffn)
  bytes[1] = Number((now >> 32n) & 0xffn)
  bytes[2] = Number((now >> 24n) & 0xffn)
  bytes[3] = Number((now >> 16n) & 0xffn)
  bytes[4] = Number((now >> 8n) & 0xffn)
  bytes[5] = Number(now & 0xffn)
  const rnd = randomUUID().replace(/-/g, '')
  for (let i = 6; i < 16; i++) bytes[i] = Number.parseInt(rnd.slice(i * 2, i * 2 + 2), 16)
  bytes[6] = (bytes[6]! & 0x0f) | 0x70
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const h = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
