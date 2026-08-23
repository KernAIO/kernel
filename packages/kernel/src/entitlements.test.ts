/**
 * Limits, and the case that matters most: nobody selling anything.
 *
 * Every self-hosted instance runs with no billing module, so the path where the procedure is simply
 * absent is not an edge case — it is what almost every Kern installation does on every request. It
 * has to be unlimited, silent, and impossible to make throw.
 */
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
