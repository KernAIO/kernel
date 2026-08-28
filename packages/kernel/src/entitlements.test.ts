/**
 * Limits, and the case that matters most: nobody selling anything.
 *
 * Every self-hosted instance runs with no billing module, so the path where the procedure is simply
 * absent is not an edge case — it is what almost every Kern installation does on every request. It
 * has to be unlimited, silent, and impossible to make throw.
 */
import type { NatsConnection } from 'nats'
import { describe, expect, it } from 'vitest'
import { systemPrincipal } from './auth.js'
import { ProcedureBroker } from './call.js'
import { ENTITLEMENTS_PROCEDURE, Entitlements, UNLIMITED } from './entitlements.js'
import { KernError } from './errors.js'
import { createLogger } from './logger.js'

const log = createLogger('test')
const system = systemPrincipal('test')

function broker() {
  return new ProcedureBroker({ service: 'test', log })
}

/** The error a call rejected with — and a failure if it did not reject at all. */
async function caught(p: Promise<unknown>): Promise<KernError> {
  try {
    await p
  } catch (e) {
    return e as KernError
  }
  throw new Error('expected a rejection, got a resolved promise')
}

/** Register a stand-in biller and count how often it is actually asked. */
function withBiller(answer: Record<string, unknown> | null) {
  const b = broker()
  const calls = { n: 0 }
  // only the first dot separates module from procedure: `billing` owns `entitlements.get`
  const dot = ENTITLEMENTS_PROCEDURE.indexOf('.')
  const module = ENTITLEMENTS_PROCEDURE.slice(0, dot)
  const proc = ENTITLEMENTS_PROCEDURE.slice(dot + 1)
  b.register(module, {
    [proc]: {
      handler: async () => {
        calls.n++
        return answer
      },
    },
  })
  return { b, calls }
}

describe('entitlements', () => {
  it('is unlimited when no module answers, and never throws', async () => {
    const ent = new Entitlements(broker(), system)
    await expect(ent.of('ws-1')).resolves.toEqual(UNLIMITED)
    await expect(ent.require('ws-1', 'seats', 10_000)).resolves.toBeUndefined()
    await expect(ent.require('ws-1', 'storageBytes', 2 ** 50)).resolves.toBeUndefined()
    await expect(ent.allowsModule('ws-1', 'anything')).resolves.toBe(true)
    await expect(ent.has('ws-1', 'sso')).resolves.toBe(true)
    await expect(ent.requireActive('ws-1')).resolves.toBeUndefined()
  })

  it('fills the keys a plan does not mention from the unlimited default', async () => {
    const { b } = withBiller({ seats: 3, planName: 'Team' })
    const ent = new Entitlements(b, system)
    const e = await ent.of('ws-1')
    expect(e.seats).toBe(3)
    expect(e.planName).toBe('Team')
    // not mentioned by the plan, so not limited by it
    expect(e.storageBytes).toBeNull()
    expect(e.modules).toBeNull()
    expect(e.sso).toBe(true)
    b.close()
  })

  it('allows a total up to the limit and refuses the one past it', async () => {
    const { b } = withBiller({ seats: 3, planName: 'Team' })
    const ent = new Entitlements(b, system)
    await expect(ent.require('ws-1', 'seats', 3)).resolves.toBeUndefined()
    await expect(ent.require('ws-1', 'seats', 4)).rejects.toThrow(KernError)
    b.close()
  })

  it('names the limit and the plan, so the interface can offer the upgrade', async () => {
    const { b } = withBiller({ seats: 3, planName: 'Team' })
    const ent = new Entitlements(b, system)
    const err = await caught(ent.require('ws-1', 'seats', 5))
    expect(err).toBeInstanceOf(KernError)
    expect(err.code).toBe('CONFLICT')
    expect(err.reason).toBe('billing.seats.limit_reached')
    expect(err.details).toMatchObject({ key: 'seats', limit: 3, wanted: 5, plan: 'Team' })
    b.close()
  })

  it('restricts modules only when the plan lists them', async () => {
    const { b } = withBiller({ modules: ['tracker'] })
    const ent = new Entitlements(b, system)
    await expect(ent.allowsModule('ws-1', 'tracker')).resolves.toBe(true)
    await expect(ent.allowsModule('ws-1', 'chat')).resolves.toBe(false)
    b.close()
  })

  it('refuses writes while a subscription is not current, and says why', async () => {
    const { b } = withBiller({ active: false, planName: 'Team' })
    const ent = new Entitlements(b, system)
    const err = await caught(ent.requireActive('ws-1'))
    expect(err).toBeInstanceOf(KernError)
    expect(err.reason).toBe('billing.subscription.inactive')
    b.close()
  })

  it('caches per workspace, and invalidation makes the next read fresh', async () => {
    const { b, calls } = withBiller({ seats: 3 })
    const ent = new Entitlements(b, system)
    await ent.of('ws-1')
    await ent.of('ws-1')
    expect(calls.n).toBe(1)
    await ent.of('ws-2')
    expect(calls.n).toBe(2)
    ent.invalidate('ws-1')
    await ent.of('ws-1')
    expect(calls.n).toBe(3)
    // ws-2 was not invalidated
    await ent.of('ws-2')
    expect(calls.n).toBe(3)
    b.close()
  })
})

/**
 * The defect this half fixes: `of()` gated on `broker.has()`, which only ever consults the **local**
 * module registry. `module-billing` is hosted in `core`, so `chat`, `mail` and `collab` answered
 * UNLIMITED for every workspace without asking anybody — and every entitlement check written in one
 * of those services was a no-op nobody would ever notice, including the API budget added beside it.
 *
 * A stubbed connection is enough to show it, because the whole question is whether the bus is
 * consulted at all.
 */
function bus(request: NatsConnection['request']): NatsConnection {
  return { request } as unknown as NatsConnection
}
const answering = (payload: unknown) =>
  bus((async () => ({
    data: new TextEncoder().encode(JSON.stringify({ ok: true, result: payload })),
  })) as unknown as NatsConnection['request'])
const noResponders = () =>
  bus(async () => {
    throw Object.assign(new Error('503'), { code: '503' })
  })
const wedged = () =>
  bus(async () => {
    throw Object.assign(new Error('TIMEOUT'), { code: 'TIMEOUT' })
  })

describe('a service that does not host the billing module', () => {
  it('asks over the bus instead of assuming there are no limits', async () => {
    const b = new ProcedureBroker({ service: 'chat', log, nats: answering({ seats: 3, planName: 'Team' }) })
    expect(b.has(ENTITLEMENTS_PROCEDURE)).toBe(false)
    const e = await new Entitlements(b, system).of('ws-1')
    expect(e.seats).toBe(3)
    expect(e.planName).toBe('Team')
    expect(e.source).toBe('plan')
  })

  it('takes "nobody is hosting it" as an answer: unlimited, and it says so', async () => {
    const b = new ProcedureBroker({ service: 'chat', log, nats: noResponders() })
    const e = await new Entitlements(b, system).of('ws-1')
    expect(e).toEqual(UNLIMITED)
    expect(e.source).toBe('none')
  })

  /**
   * The distinction the whole `source` field exists for. Both let the request through — a billing
   * outage must never lock a paying customer out of their own workspace — but only one of them is an
   * answer, and anything reporting on limits has to be able to tell an operator which it had.
   */
  it('marks a biller that did not answer as unavailable, not as unlimited', async () => {
    const b = new ProcedureBroker({ service: 'chat', log, nats: wedged() })
    const e = await new Entitlements(b, system, undefined, log).of('ws-1')
    expect(e.apiRateLimit).toBeNull()
    expect(e.seats).toBeNull()
    expect(e.source).toBe('unavailable')
  })

  it('never throws on any of those paths', async () => {
    for (const nats of [answering(null), noResponders(), wedged()]) {
      const ent = new Entitlements(
        new ProcedureBroker({ service: 'chat', log, nats }),
        system,
        undefined,
        log,
      )
      await expect(ent.of('ws-1')).resolves.toBeTruthy()
      await expect(ent.require('ws-1', 'seats', 10_000)).resolves.toBeUndefined()
      await expect(ent.requireActive('ws-1')).resolves.toBeUndefined()
    }
  })

  /** No local copy and no bus is the one case where "certainly nobody" needs no round trip. */
  it('does not go looking when there is no bus at all', async () => {
    const b = new ProcedureBroker({ service: 'worker', log })
    expect(b.mightAnswer(ENTITLEMENTS_PROCEDURE)).toBe(false)
    expect((await new Entitlements(b, system).of('ws-1')).source).toBe('none')
  })
})

describe('where a resolved entitlement came from', () => {
  it('is "none" for the unlimited default every self-hosted instance uses', () => {
    expect(UNLIMITED.source).toBe('none')
  })

  it('is "plan" when a module answered, even if the answer mentions nothing', async () => {
    const { b } = withBiller({})
    expect((await new Entitlements(b, system).of('ws-1')).source).toBe('plan')
    b.close()
  })
})
