/**
 * The demo-seed wiring.
 *
 * A module declares `demo` and nothing else; the kernel is what subscribes it to
 * `core.workspace.demo_seed`. That subscription is the whole feature, and it is invisible from
 * either end — a module author cannot see it and core cannot see it — so it is the one part that
 * needs a test of its own. What it has to prove is that the handler runs, that it is handed a
 * principal carrying the workspace owner rather than a nameless service, and that a seeder which
 * throws costs its own content and nothing else.
 */
import { randomUUID } from 'node:crypto'
import type { EventEnvelope } from '@kernhq/contracts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createKernel, type Kernel } from './kernel.js'
import { DEMO_SEED_EVENT, type DemoSeedContext, defineModule, defineServerModule } from './module.js'

const BASE_URL = process.env.DATABASE_URL

const WS = randomUUID()
const OWNER = randomUUID()

const seen: DemoSeedContext[] = []
let explode = false

const good = defineServerModule({
  definition: defineModule({ id: 'demogood', name: 'Good', version: '1.0.0' }),
  demo: {
    seed: async (ctx) => {
      seen.push(ctx)
      return { created: { things: 2 } }
    },
  },
})

/** A module whose seeder fails, so the other one's must still run. */
const bad = defineServerModule({
  definition: defineModule({ id: 'demobad', name: 'Bad', version: '1.0.0' }),
  demo: {
    seed: async () => {
      if (explode) throw new Error('this seeder is broken')
      return { skipped: true }
    },
  },
})

/** A module with no `demo` at all: the kernel must not subscribe anything for it. */
const quiet = defineServerModule({
  definition: defineModule({ id: 'demoquiet', name: 'Quiet', version: '1.0.0' }),
})

/** The event exactly as core publishes it. */
const envelope = (): EventEnvelope => ({
  id: randomUUID() as EventEnvelope['id'],
  name: DEMO_SEED_EVENT,
  version: 1,
  module: 'core' as EventEnvelope['module'],
  workspaceId: WS as EventEnvelope['workspaceId'],
  actorId: OWNER as EventEnvelope['actorId'],
  occurredAt: new Date().toISOString(),
  payload: { workspaceId: WS, actorId: OWNER },
})

let kernel: Kernel

describe.skipIf(!BASE_URL)('a module that declares demo content', () => {
  beforeAll(async () => {
    kernel = await createKernel({
      service: 'demo-wiring-test',
      modules: [good, bad, quiet],
      role: 'api',
      env: {
        DATABASE_URL: BASE_URL,
        KERN_SECRET: 'test-secret-that-is-long-enough-for-kern',
        NODE_ENV: 'test',
        NATS_URL: undefined,
        VALKEY_URL: undefined,
      },
    })
    await kernel.start()
  }, 120_000)

  afterAll(async () => {
    await kernel?.stop().catch(() => undefined)
  })

  it('is asked to seed when core publishes the event', async () => {
    seen.length = 0
    await kernel.events.publishRaw(envelope())
    expect(seen.length).toBe(1)
    expect(seen[0]?.workspaceId).toBe(WS)
    expect(seen[0]?.actorId).toBe(OWNER)
    expect(seen[0]?.now).toBeInstanceOf(Date)
  })

  it('is handed a service principal carrying the owner, so what it writes has an author', () => {
    const actor = seen[0]?.actor
    // A service principal passes the permission and membership checks a module's own services
    // apply — the workspace is a minute old and has no roles yet.
    expect(actor?.kind).toBe('service')
    expect(actor?.instanceAdmin).toBe(true)
    // …and carries the owner, so the demo issues have a reporter and the pages have an author.
    expect(actor?.userId).toBe(OWNER)
  })

  it('does not let one broken seeder stop another module from seeding', async () => {
    seen.length = 0
    explode = true
    try {
      await expect(kernel.events.publishRaw(envelope())).resolves.not.toThrow()
    } finally {
      explode = false
    }
    expect(seen.length).toBe(1)
  })
})
