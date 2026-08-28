/**
 * The per-workspace request budget — the one place `apiRateLimit` is enforced.
 *
 * Two of these matter more than the arithmetic. The first is that an instance with no billing module
 * does no work at all: that is every self-hosted install on every workspace-scoped request, so a
 * budget that reached for Valkey there would be a cost paid by the people who are not being billed.
 * The second is that nothing here may refuse for a reason of its own — losing the ability to *count*
 * is not a reason to refuse a customer their own API.
 */
import { describe, expect, it, vi } from 'vitest'
import { systemPrincipal } from './auth.js'
import { ProcedureBroker } from './call.js'
import { ENTITLEMENTS_PROCEDURE, Entitlements } from './entitlements.js'
import { createLogger } from './logger.js'
import { memoryCounter, type RateCounter, redisCounter, WorkspaceApiBudget } from './ratelimit.js'

const log = createLogger('test')
const system = systemPrincipal('test')

/** A broker with a stand-in biller, or with nobody at all. */
function billing(apiRateLimit: number | null, planName: string | null = 'Team') {
  const b = new ProcedureBroker({ service: 'test', log })
  b.register('billing', {
    'entitlements.get': { handler: async () => ({ apiRateLimit, planName }) },
  })
  return b
}

const budgetFor = (limit: number | null, counter: RateCounter = memoryCounter()) =>
  new WorkspaceApiBudget(new Entitlements(billing(limit), system), counter, log)

describe('the workspace API budget', () => {
  it('allows the request at the limit and refuses the one past it', async () => {
    const budget = budgetFor(3)
    for (let i = 0; i < 3; i++) expect(await budget.check('ws-1')).toEqual({ ok: true })
    const verdict = await budget.check('ws-1')
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      expect(verdict.limit).toBe(3)
      expect(verdict.plan).toBe('Team')
      // enough for a `retry-after` that is neither zero nor a lie
      expect(verdict.retryAfterSec).toBeGreaterThan(0)
      expect(verdict.retryAfterSec).toBeLessThanOrEqual(60)
    }
  })

  it('counts each workspace separately, which is the whole point of it being per workspace', async () => {
    const budget = budgetFor(1)
    expect(await budget.check('ws-1')).toEqual({ ok: true })
    expect((await budget.check('ws-1')).ok).toBe(false)
    expect(await budget.check('ws-2')).toEqual({ ok: true })
  })

  it('starts a fresh window when the minute rolls over', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-08-28T10:00:30.000Z'))
      const budget = budgetFor(1)
      expect(await budget.check('ws-1')).toEqual({ ok: true })
      expect((await budget.check('ws-1')).ok).toBe(false)
      vi.setSystemTime(new Date('2026-08-28T10:01:01.000Z'))
      expect(await budget.check('ws-1')).toEqual({ ok: true })
    } finally {
      vi.useRealTimers()
    }
  })

  /**
   * The self-host path: nothing bills, so `apiRateLimit` is null and there is nothing to count.
   * Asserted by counting the counter, not by the verdict — a budget that let everything through
   * *after* a round trip to Valkey would pass a verdict-only test and still be wrong.
   */
  it('does not count at all when no plan limits the API', async () => {
    let hits = 0
    const counter: RateCounter = {
      hit: async () => {
        hits++
        return 1
      },
    }
    const budget = new WorkspaceApiBudget(
      new Entitlements(new ProcedureBroker({ service: 'test', log }), system),
      counter,
      log,
    )
    for (let i = 0; i < 50; i++) expect(await budget.check('ws-1')).toEqual({ ok: true })
    expect(hits).toBe(0)
  })

  it('treats a limit of zero as no limit rather than as "refuse everything"', async () => {
    // A plan row with 0 in it is far more likely to be an unset field than a deliberate ban.
    const budget = budgetFor(0)
    expect(await budget.check('ws-1')).toEqual({ ok: true })
  })

  it('lets the request through when the counter is unreachable', async () => {
    const broken: RateCounter = {
      hit: async () => {
        throw new Error('valkey is down')
      },
    }
    const budget = budgetFor(1, broken)
    expect(await budget.check('ws-1')).toEqual({ ok: true })
    expect(await budget.check('ws-1')).toEqual({ ok: true })
  })

  it('lets the request through when the entitlement lookup itself fails', async () => {
    const entitlements = {
      of: async () => {
        throw new Error('billing exploded')
      },
    } as unknown as Entitlements
    const budget = new WorkspaceApiBudget(entitlements, memoryCounter(), log)
    expect(await budget.check('ws-1')).toEqual({ ok: true })
  })
})

describe('the Valkey counter', () => {
  /** `INCR`, and `EXPIRE` only on the first hit — the window is in the key, so expiry is cleanup. */
  it('expires the key once per window, not once per request', async () => {
    let n = 0
    const expires: Array<[string, number]> = []
    const counter = redisCounter({
      incr: async () => ++n,
      expire: async (key, seconds) => {
        expires.push([key, seconds])
        return 1
      },
    })
    expect(await counter.hit('k', 120)).toBe(1)
    expect(await counter.hit('k', 120)).toBe(2)
    expect(await counter.hit('k', 120)).toBe(3)
    expect(expires).toEqual([['k', 120]])
  })
})

describe('the entitlements procedure name this all hangs off', () => {
  it('is the one a billing module registers', () => {
    expect(ENTITLEMENTS_PROCEDURE).toBe('billing.entitlements.get')
  })
})
