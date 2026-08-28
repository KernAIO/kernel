import type { Principal } from '@kernhq/contracts'
import { ErrorCode, type NatsConnection, StringCodec } from 'nats'
import type { z } from 'zod'
import { KernError } from './errors.js'
import type { Logger } from './logger.js'

/**
 * The `reason` on the `UNAVAILABLE` a cross-service call fails with, so a caller can tell the two
 * apart. Both are 503; only one of them is a fault.
 *
 * `NO_RESPONDERS` is a **fact**: nothing in this instance hosts the procedure. NATS answers a
 * request with no subscriber immediately and explicitly (`503 no responders`), so this is knowable
 * rather than merely indistinguishable from a slow answer — which is what lets a caller treat "no
 * billing module is installed" as an answer instead of as an outage.
 *
 * `RPC_UNREACHABLE` is the opposite: somebody may well be hosting it and we did not find out — a
 * timeout, a dropped connection. A caller that falls open must not report this as though it had
 * asked and been told there were no limits.
 *
 * The error *code* stays `UNAVAILABLE` for both, because consumers already branch on it.
 */
export const NO_RESPONDERS = 'kernel.rpc.no_responders'
export const RPC_UNREACHABLE = 'kernel.rpc.unreachable'

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

  /**
   * Whether **this process** hosts the procedure.
   *
   * Local only, and that is the whole point of `mightAnswer` existing beside it: a caller that gates
   * on `has()` silently decides that everything hosted in another service does not exist. That is
   * what made `kernel.entitlements` unlimited in `chat`, `mail` and `collab` — every one of them
   * asked `has('billing.entitlements.get')`, got `false` because billing is hosted in `core`, and
   * answered UNLIMITED without ever putting the question.
   */
  has(name: string) {
    return this.local.has(name)
  }

  /**
   * Whether the procedure could be answered from here at all — hosted locally, or possibly by
   * another service on the bus.
   *
   * "Possibly" is the honest word: nothing short of asking tells you whether a responder is
   * listening, and NATS answers that in one round trip (a request with no subscriber comes back as
   * `503 no responders` immediately, not after the timeout). So this is the cheap pre-filter — false
   * means *certainly* nobody, and `call()` then distinguishes "nobody is hosting it" from "somebody
   * is and did not answer" through the `reason` on the error it throws.
   */
  mightAnswer(name: string) {
    return this.local.has(name) || Boolean(this.opts.nats)
  }

  async call<TOut = unknown>(
    name: string,
    input: unknown,
    principal: Principal,
    opts: { timeoutMs?: number } = {},
  ): Promise<TOut> {
    const def = this.local.get(name)
    if (def) return (await this.invokeLocal(name, def, input, principal)) as TOut
    if (!this.opts.nats)
      throw new KernError(
        'UNAVAILABLE',
        `Procedure ${name} is not hosted here and NATS is not configured`,
        { procedure: name },
        NO_RESPONDERS,
      )
    let res: Awaited<ReturnType<NatsConnection['request']>>
    try {
      res = await this.opts.nats.request(
        `kern.rpc.${name}`,
        sc.encode(JSON.stringify({ input, principal })),
        { timeout: opts.timeoutMs ?? this.opts.timeoutMs ?? 10_000 },
      )
    } catch (err) {
      // 503: the bus is up and nothing subscribes to this subject — a definite "no such procedure in
      // this instance". Anything else (a timeout, a dropped connection) means we do not know.
      if ((err as { code?: string }).code === ErrorCode.NoResponders)
        throw new KernError(
          'UNAVAILABLE',
          `No service in this instance hosts ${name}`,
          { procedure: name },
          NO_RESPONDERS,
        )
      throw new KernError(
        'UNAVAILABLE',
        `${name} did not answer: ${err instanceof Error ? err.message : String(err)}`,
        { procedure: name },
        RPC_UNREACHABLE,
      )
    }
    const wire = JSON.parse(sc.decode(res.data)) as Wire
    if (!wire.ok)
      throw new KernError((wire.error!.code as any) ?? 'INTERNAL', wire.error!.message, wire.error!.details)
    return wire.result as TOut
  }

  private async invokeLocal(_name: string, def: ProcedureDef, input: unknown, principal: Principal) {
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
