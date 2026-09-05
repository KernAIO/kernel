/**
 * A blank environment variable is not an absent one, and `startTestInfra` read it with truthiness.
 *
 * All three shipped stacks pass every variable through unconditionally, and a developer's shell
 * carries the same habit, so `NATS_URL=''` is the normal shape of "I did not set this". It came
 * back as `natsUrl: ''` — a string the interface types as a URL. Nothing threw: `createEventBus`
 * reads `''` as falsy and hands back the in-memory bus, so a suite that asked for `{ nats: true }`
 * exercised no broker at all and still reported green.
 *
 * These only cover the shared-infra branch, which is the one that needs no Docker. That is also the
 * branch both defects lived in.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { startTestInfra } from './index.js'

const URL = 'postgres://kern:kern@localhost:5432/kern'
const original = { database: process.env.DATABASE_URL, nats: process.env.NATS_URL }

afterEach(() => {
  for (const [key, value] of [
    ['DATABASE_URL', original.database],
    ['NATS_URL', original.nats],
  ] as const)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
})

describe('startTestInfra on the shared dev infra', () => {
  it('returns the database URL it was given', async () => {
    process.env.DATABASE_URL = URL
    delete process.env.NATS_URL
    await expect(startTestInfra()).resolves.toMatchObject({ databaseUrl: URL })
  })

  it('reports a blank NATS_URL as unset rather than as an empty URL', async () => {
    process.env.DATABASE_URL = URL
    for (const blank of ['', '   ', '\t\n']) {
      process.env.NATS_URL = blank
      const infra = await startTestInfra({ nats: true })
      // `''` here is what made a suite that asked for a broker silently run without one.
      expect(infra.natsUrl, `NATS_URL=${JSON.stringify(blank)}`).toBeUndefined()
    }
  })

  it('keeps a NATS_URL that is actually set', async () => {
    process.env.DATABASE_URL = URL
    process.env.NATS_URL = 'nats://localhost:4222'
    await expect(startTestInfra({ nats: true })).resolves.toMatchObject({
      natsUrl: 'nats://localhost:4222',
    })
  })

  it('does not take a whitespace-only DATABASE_URL as a connection string', async () => {
    // `Boolean('   ')` is true, so this used to satisfy the guard and reach `pg` as a URL. There is
    // no Docker in this test, so the honest assertion is the narrow one: whatever it decides to do,
    // it must not hand the blank straight back as the database to connect to.
    process.env.DATABASE_URL = '   '
    delete process.env.NATS_URL
    const shortcut = await Promise.race([
      startTestInfra().then((i) => i.databaseUrl),
      new Promise<'took-the-container-path'>((r) => setTimeout(() => r('took-the-container-path'), 250)),
    ]).catch(() => 'took-the-container-path' as const)
    expect(shortcut).not.toBe('   ')
  })
})
