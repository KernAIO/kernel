/**
 * The per-workspace half of rate limiting: what a *plan* allows, as opposed to what one IP address
 * may do.
 *
 * `kernel.entitlements` has declared `apiRateLimit` since it was written and nothing read it, which
 * makes it exactly the kind of key CLAUDE.md warns about — a plan that promises a limit nobody
 * applies is a pricing page telling a lie. This is its one enforcement site, and `workspaceScoped`
 * is the only thing that calls it.
 *
 * Three properties matter more than precision here:
 *
 * 1. **Unlimited is free.** With no billing module the entitlement is `apiRateLimit: null`, resolved
 *    from a cache, and this does no I/O at all. That is every self-hosted instance on every request.
 * 2. **It never throws.** A Valkey that is down, a counter that errors — the request goes through.
 *    Losing the ability to count is not a reason to refuse a customer their own API.
 * 3. **It is shared.** The budget belongs to the workspace, not to the process, so it has to be
 *    counted somewhere every replica can see. Valkey is that somewhere when there is one; without
 *    it the count is per process, which is honest for the single-process instance that has no
 *    Valkey and is stated rather than hidden.
 */
import type { Entitlements } from './entitlements.js'
import type { Logger } from './logger.js'

/** The window every budget is expressed in. `apiRateLimit` is documented as requests per minute. */
export const WINDOW_MS = 60_000

/**
 * Somewhere to keep a count that resets. `hit` returns the running total **including** this request.
 *
 * The key already carries the window it belongs to, so an implementation never has to expire
 * anything for correctness — only to stop old keys accumulating.
 */
export interface RateCounter {
  hit(key: string, ttlSec: number): Promise<number>
}

/** Minimal shape of the ioredis client the kernel holds, so this file does not depend on ioredis. */
export interface CounterRedis {
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<unknown>
}

/**
 * Valkey-backed counter.
 *
 * `INCR` then `EXPIRE` only on the first hit of a window — the window is part of the key, so the
 * expiry is housekeeping rather than the mechanism, and it costs one extra round trip a minute per
 * workspace instead of one per request.
 */
export function redisCounter(redis: CounterRedis): RateCounter {
  return {
    async hit(key, ttlSec) {
      const n = await redis.incr(key)
      if (n === 1) await redis.expire(key, ttlSec)
      return n
    },
  }
}

/** In-process counter, for an instance with no Valkey. Old windows are dropped as they are passed. */
export function memoryCounter(): RateCounter {
  const counts = new Map<string, number>()
  return {
    async hit(key) {
      const n = (counts.get(key) ?? 0) + 1
      counts.set(key, n)
      // Keys carry their window, so anything that is not the current one can never be read again.
      if (counts.size > 10_000) for (const k of counts.keys()) if (k !== key) counts.delete(k)
      return n
    },
  }
}

export type BudgetVerdict =
  | { ok: true }
  | {
      ok: false
      /** requests per minute the plan allows */
      limit: number
      /** how many this window has already seen */
      used: number
      plan: string | null
      /** seconds until the window rolls over, for `retry-after` */
      retryAfterSec: number
    }

/**
 * A workspace's request budget for the current minute.
 *
 * Fixed windows, not a sliding one: the window is part of the key, so it needs no bookkeeping, it
 * cannot leak keys, and a replica that restarts does not lose the count. A caller can spend two
 * windows' worth across a boundary; that is the known cost and it is the right trade for something
 * on the path of every workspace-scoped request in the instance.
 */
export class WorkspaceApiBudget {
  constructor(
    private readonly entitlements: Entitlements,
    private readonly counter: RateCounter,
    private readonly log?: Logger,
  ) {}

  /** Never rejects. `{ ok: true }` also means "we could not count", which is deliberate. */
  async check(workspaceId: string): Promise<BudgetVerdict> {
    const ent = await this.entitlements.of(workspaceId).catch(() => null)
    const limit = ent?.apiRateLimit ?? null
    if (limit === null || limit <= 0) return { ok: true }
    const window = Math.floor(Date.now() / WINDOW_MS)
    try {
      const used = await this.counter.hit(
        `kern:rl:ws:${workspaceId}:${window}`,
        Math.ceil(WINDOW_MS / 1000) * 2,
      )
      if (used <= limit) return { ok: true }
      return {
        ok: false,
        limit,
        used,
        plan: ent?.planName ?? null,
        retryAfterSec: Math.max(1, Math.ceil(((window + 1) * WINDOW_MS - Date.now()) / 1000)),
      }
    } catch (err) {
      // Counting is best effort. An unreachable Valkey must not become an unreachable API.
      this.log?.warn(
        { workspaceId, err: err instanceof Error ? err.message : String(err) },
        'api budget: could not count this request; letting it through',
      )
      return { ok: true }
    }
  }
}
