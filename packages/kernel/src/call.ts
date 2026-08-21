import type { Principal } from '@kernalo/contracts'
import { type NatsConnection, StringCodec } from 'nats'
import type { z } from 'zod'
import { KernError } from './errors.js'
import type { Logger } from './logger.js'

const sc = StringCodec()
export interface ProcedureDef {
  input?: z.ZodTypeAny
  output?: z.ZodTypeAny
  handler: (input: any, ctx: { principal: Principal }) => Promise<any>
}
interface Wire {
  ok: boolean
  result?: unknown
  error?: { code: string; message: string; details?: Record<string, unknown> }
}

/**
 * Cross-module / cross-service request-reply. `name` is `<module>.<procedure>`.
 * In-process if the module is hosted here, otherwise NATS request on `kern.rpc.<module>.<procedure>`.
 */
export class ProcedureBroker {
  private readonly local = new Map<string, ProcedureDef>()
  private readonly subs: Array<{ unsubscribe(): void }> = []
  constructor(
    private readonly opts: { service: string; log: Logger; nats?: NatsConnection; timeoutMs?: number },
  ) {}

  register(module: string, procedures: Record<string, ProcedureDef>) {
    for (const [proc, def] of Object.entries(procedures)) {
      const name = `${module}.${proc}`
      this.local.set(name, def)
      if (this.opts.nats) {
        const sub = this.opts.nats.subscribe(`kern.rpc.${name}`, { queue: `rpc-${module}` })
        this.subs.push(sub)
        ;(async () => {
          for await (const m of sub) {
            let reply: Wire
            try {
              const { input, principal } = JSON.parse(sc.decode(m.data)) as {
                input: unknown
                principal: Principal
              }
              reply = { ok: true, result: await this.invokeLocal(name, def, input, principal) }
            } catch (err) {
              reply = { ok: false, error: toWireError(err) }
            }
            m.respond(sc.encode(JSON.stringify(reply)))
          }
        })().catch((err) => this.opts.log.error({ err, name }, 'rpc loop ended'))
      }
    }
  }

  has(name: string) {
    return this.local.has(name)
  }

  async call<TOut = unknown>(name: string, input: unknown, principal: Principal): Promise<TOut> {
    const def = this.local.get(name)
    if (def) return (await this.invokeLocal(name, def, input, principal)) as TOut
    if (!this.opts.nats)
      throw new KernError('UNAVAILABLE', `Procedure ${name} is not hosted here and NATS is not configured`)
    const res = await this.opts.nats.request(
      `kern.rpc.${name}`,
      sc.encode(JSON.stringify({ input, principal })),
      { timeout: this.opts.timeoutMs ?? 10_000 },
    )
    const wire = JSON.parse(sc.decode(res.data)) as Wire
    if (!wire.ok)
      throw new KernError((wire.error!.code as any) ?? 'INTERNAL', wire.error!.message, wire.error!.details)
    return wire.result as TOut
  }

  private async invokeLocal(name: string, def: ProcedureDef, input: unknown, principal: Principal) {
    const parsed = def.input ? def.input.parse(input) : input
    const out = await def.handler(parsed, { principal })
    return def.output ? def.output.parse(out) : out
  }
  close() {
    for (const s of this.subs) s.unsubscribe()
  }
}

function toWireError(err: unknown): Wire['error'] {
  if (err instanceof KernError) return { code: err.code, message: err.message, details: err.details }
  return { code: 'INTERNAL', message: err instanceof Error ? err.message : String(err) }
}
