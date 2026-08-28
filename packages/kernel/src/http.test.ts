/**
 * The status code a Kern error actually reaches the client with.
 *
 * oRPC derives an error's HTTP status from its own table of standard codes and falls back to 500 for
 * anything it does not recognise. Kern adds codes of its own (`MODULE_DISABLED`, `VALIDATION`,
 * `UNAVAILABLE`), so every one of them has to carry its status explicitly — `httpStatusFor` alone is
 * not enough, it has to be handed to `ORPCError`. `MODULE_DISABLED` did not, and every module behind
 * `workspaceScoped` answered 500 for a workspace that had simply switched the module off.
 *
 * The assertions here go over a real Fastify server on a real port, through both surfaces the kernel
 * mounts: the OpenAPI REST routes and the oRPC RPC protocol the app's SDK uses.
 */
import type { AddressInfo } from 'node:net'
import { ANONYMOUS, ErrorCode, type Principal } from '@kernhq/contracts'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { type UnscopedAccess, UnscopedAccessSignal } from './access-signal.js'
import { NO_RESPONDERS, type ProcedureBroker } from './call.js'
import { type Entitlement, Entitlements } from './entitlements.js'
import { httpStatusFor, KernError } from './errors.js'
import {
  allowWhileSuspended,
  createHttpServer,
  DEFAULT_TRUSTED_PROXIES,
  kernErrorToORPC,
  o,
  requiresCapability,
  trustProxyFrom,
  workspaceScoped,
} from './http.js'
import type { Kernel } from './kernel.js'
import { defineModule, defineServerModule, type ServerModule } from './module.js'
import type { BudgetVerdict } from './ratelimit.js'
import { ModuleRegistry } from './registry.js'

const WORKSPACE = '01920000-0000-7000-8000-0000000000aa'

const member: Principal = {
  kind: 'user',
  userId: '01920000-0000-7000-8000-0000000000b1' as Principal['userId'],
  email: 'member@example.test',
  name: 'Member',
  locale: 'en',
  instanceAdmin: false,
  service: null,
  memberships: [
    {
      workspaceId: WORKSPACE as Principal['memberships'][number]['workspaceId'],
      role: 'member',
      roleIds: [],
      groupIds: [],
      status: 'active',
    },
  ],
  permissionVersion: 0,
}

/** An operator: no membership anywhere, and allowed in everywhere. */
const admin: Principal = {
  ...member,
  userId: '01920000-0000-7000-8000-0000000000c1' as Principal['userId'],
  email: 'operator@example.test',
  name: 'Operator',
  instanceAdmin: true,
  memberships: [],
}

/** Another Kern service calling in. Internal traffic is not the customer's subscription. */
const service: Principal = {
  kind: 'service',
  userId: null,
  email: null,
  name: null,
  locale: 'en',
  instanceAdmin: false,
  service: 'chat',
  memberships: [],
  permissionVersion: 0,
}

const Input = z.object({ workspaceId: z.string() })
const Output = z.object({ ok: z.boolean() })

const router = () => ({
  widgets: {
    get: o
      .use(workspaceScoped('demo'))
      .route({ method: 'POST', path: '/widgets/get' })
      .input(Input)
      .output(Output)
      .handler(async () => ({ ok: true })),
    missing: o
      .use(workspaceScoped('demo'))
      .route({ method: 'POST', path: '/widgets/missing' })
      .input(Input)
      .output(Output)
      .handler(async () => {
        throw KernError.notFound('Widget')
      }),
    // behind a capability the workspace can switch off on its own
    gadget: o
      .use(workspaceScoped('demo'))
      .use(requiresCapability('demo', 'gadgets'))
      .route({ method: 'POST', path: '/widgets/gadget' })
      .input(Input)
      .output(Output)
      .handler(async () => ({ ok: true })),
    /**
     * A declared `GET`. Every call still arrives over the wire as a POST on the RPC surface, which
     * is the whole reason the read-only gate reads the contract instead of the request.
     */
    read: o
      .use(workspaceScoped('demo'))
      .route({ method: 'GET', path: '/widgets/read' })
      .input(Input)
      .output(Output)
      .handler(async () => ({ ok: true })),
    /** The shape billing's `checkout`/`portal` and core's export take: a write that suspension may not eat. */
    pay: o
      .use(workspaceScoped('demo'))
      .use(allowWhileSuspended)
      .route({ method: 'POST', path: '/widgets/pay' })
      .input(Input)
      .output(Output)
      .handler(async () => ({ ok: true })),
  },
})

const demoModule = defineServerModule({
  definition: defineModule({ id: 'demo', name: 'Demo', version: '0.0.0' }),
  router,
})

/**
 * A real `Entitlements` over a broker that answers the way each instance shape does.
 *
 * - `undefined` — nobody hosts `billing.entitlements.get`, so `mightAnswer` is false and no call is
 *   made at all. Every self-hosted Kern, on every request.
 * - `'unreachable'` — a biller exists and fails in a way that is not "nobody is listening", which is
 *   what `source: 'unavailable'` means.
 * - an object — a billing module answered; the object is its answer.
 */
function entitlementsOver(billing: Partial<Entitlement> | 'unreachable' | undefined): Entitlements {
  const broker = {
    mightAnswer: () => billing !== undefined,
    call: async () => {
      if (billing === 'unreachable')
        throw Object.assign(new Error('the billing module timed out'), { reason: 'RPC_TIMEOUT' })
      if (billing === undefined) throw Object.assign(new Error('no responders'), { reason: NO_RESPONDERS })
      return billing
    },
  } as unknown as ProcedureBroker
  return new Entitlements(broker, service, 30_000)
}

/**
 * Only the handful of kernel surfaces `createHttpServer` touches. A real kernel would need Postgres,
 * which this package's tests deliberately do without.
 */
function stubKernel(opts: {
  moduleEnabled: boolean
  capabilities?: string[]
  modules?: ServerModule[]
  /** verdict the workspace budget returns; absent means unlimited */
  budget?: BudgetVerdict
  /** service tokens `kernel.auth.verifyService` accepts */
  serviceTokens?: string[]
  crossings?: UnscopedAccess[]
  trustedProxies?: string
  /**
   * What the billing module answers, if there is one. `undefined` means nothing bills — a
   * self-hosted Kern, which is the default every other test in this file runs under.
   */
  billing?: Partial<Entitlement> | 'unreachable'
}): Kernel {
  const noop = () => {}
  const signal = new UnscopedAccessSignal()
  if (opts.crossings) {
    const into = opts.crossings
    signal.on((a) => {
      into.push(a)
    })
  }
  return {
    service: 'test',
    version: '0.0.0',
    env: { TRUSTED_PROXIES: opts.trustedProxies },
    registry: new ModuleRegistry(opts.modules ?? [demoModule]),
    log: { info: noop, warn: noop, error: noop, debug: noop, fatal: noop, trace: noop },
    database: { pool: { query: async () => ({ rows: [] }) } },
    authz: { requireMember: noop },
    auth: {
      verifyService: async (token: string) => ((opts.serviceTokens ?? []).includes(token) ? 'chat' : null),
    },
    apiBudget: { check: async () => opts.budget ?? { ok: true } },
    // the real class, over a stub broker: `source` and the fall-open branches are the thing under
    // test, and a stubbed `Entitlements` would only assert that the stub was written correctly
    entitlements: entitlementsOver(opts.billing),
    unscopedAccess: signal,
    // the request hook asks on every request whether the instance is closed for an upgrade
    maintenance: { active: async () => null },
    isModuleEnabled: async () => opts.moduleEnabled,
    capabilities: async () => new Set(opts.capabilities ?? []),
  } as unknown as Kernel
}

interface Server {
  url: string
  app: FastifyInstance
}

async function listen(kernel: Kernel, principal: Principal, rateLimit?: { max?: number }): Promise<Server> {
  const app = await createHttpServer({
    kernel,
    resolvePrincipal: async () => principal,
    corsOrigins: ['http://localhost'],
    rateLimit,
  })
  await app.listen({ port: 0, host: '127.0.0.1' })
  return { app, url: `http://127.0.0.1:${(app.server.address() as AddressInfo).port}` }
}

/** POST through the OpenAPI (REST) surface a third party or curl would use. */
const rest = (server: Server, path: string) =>
  fetch(`${server.url}/api/demo${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId: WORKSPACE }),
  })

/** GET through the OpenAPI surface, the way a declared read is actually called over REST. */
const restGet = (server: Server, path: string) =>
  fetch(`${server.url}/api/demo${path}?workspaceId=${WORKSPACE}`)

/** POST through the oRPC binary protocol the SvelteKit app talks over `@kernhq/sdk`. */
const rpc = (server: Server, procedure: string) =>
  fetch(`${server.url}/api/demo/rpc/${procedure}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ json: { workspaceId: WORKSPACE }, meta: [] }),
  })

let enabled: Server
let disabled: Server
let anonymous: Server
/** module on, capability off — the case the whole middleware exists for */
let capabilityOff: Server

beforeAll(async () => {
  enabled = await listen(stubKernel({ moduleEnabled: true, capabilities: ['gadgets'] }), member)
  disabled = await listen(stubKernel({ moduleEnabled: false }), member)
  anonymous = await listen(stubKernel({ moduleEnabled: true, capabilities: ['gadgets'] }), ANONYMOUS)
  capabilityOff = await listen(stubKernel({ moduleEnabled: true, capabilities: [] }), member)
})
afterAll(async () => {
  await Promise.all([
    enabled?.app.close(),
    disabled?.app.close(),
    anonymous?.app.close(),
    capabilityOff?.app.close(),
  ])
})

/**
 * A capability the workspace has switched off is **not found**, not forbidden.
 *
 * 403 would tell the caller the feature exists and they are merely not allowed it — true for a
 * missing permission, wrong for a workspace that does not have the feature at all. It also
 * contradicts the shell, which has already dropped the navigation, and turns a hidden menu into an
 * API that answers as though something were being withheld.
 */
describe('a capability disabled in the workspace', () => {
  it('answers 404 over the REST surface', async () => {
    const res = await rest(capabilityOff, '/widgets/gadget')
    expect(res.status).toBe(404)
  })

  it('answers 404 over the RPC surface too', async () => {
    const res = await rpc(capabilityOff, 'widgets/gadget')
    expect(res.status).toBe(404)
    const body = (await res.json()) as { json?: { code?: string } }
    expect(body.json?.code).toBe('NOT_FOUND')
  })

  it('lets the call through when the capability is on', async () => {
    const res = await rest(enabled, '/widgets/gadget')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('leaves procedures that are not behind a capability alone', async () => {
    const res = await rest(capabilityOff, '/widgets/get')
    expect(res.status).toBe(200)
  })

  it('still refuses the whole module first when the module itself is off', async () => {
    // Order matters: a disabled module must not leak which capabilities it would have had.
    const res = await rest(disabled, '/widgets/gadget')
    expect(res.status).toBe(403)
    const body = (await res.json()) as { code?: string }
    expect(body.code).toBe('MODULE_DISABLED')
  })
})

describe('a module disabled in the workspace', () => {
  it('answers 403 over the REST surface, not 500', async () => {
    const res = await rest(disabled, '/widgets/get')
    expect(res.status).toBe(403)
    const body = (await res.json()) as { code?: string; data?: { module?: string } }
    expect(body.code).toBe('MODULE_DISABLED')
    expect(body.data?.module).toBe('demo')
  })

  it('answers 403 over the RPC surface too', async () => {
    const res = await rpc(disabled, 'widgets/get')
    expect(res.status).toBe(403)
    const body = (await res.json()) as { json?: { code?: string } }
    expect(body.json?.code).toBe('MODULE_DISABLED')
  })
})

describe('the rest of the error mapping, over the same wire', () => {
  it('lets the call through when the module is enabled', async () => {
    const res = await rest(enabled, '/widgets/get')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('answers 401 for an anonymous caller', async () => {
    const res = await rest(anonymous, '/widgets/get')
    expect(res.status).toBe(401)
    expect(((await res.json()) as { code?: string }).code).toBe('UNAUTHORIZED')
  })

  it('answers 404 for a KernError raised inside the handler', async () => {
    const res = await rest(enabled, '/widgets/missing')
    expect(res.status).toBe(404)
    expect(((await res.json()) as { code?: string }).code).toBe('NOT_FOUND')
  })

  it('is still reachable at all: health does not go through a module', async () => {
    const res = await fetch(`${enabled.url}/api/health`)
    expect(res.status).toBe(200)
    expect(((await res.json()) as { modules?: Array<{ id: string }> }).modules).toEqual([
      { id: 'demo', version: '0.0.0' },
    ])
  })
})

describe('every Kern error code carries its own status', () => {
  // The trap `MODULE_DISABLED` fell into: oRPC only knows its standard codes, so any code whose
  // status is not passed explicitly silently becomes a 500.
  it.each(ErrorCode.options)('%s', (code) => {
    const orpc = kernErrorToORPC(new KernError(code, 'boom')) as { status: number }
    expect(orpc.status).toBe(httpStatusFor(code))
  })
})

describe('kernErrorToORPC', () => {
  /**
   * `reason` used to stop at the server. Every `KernError.conflict(message, reason)` in core —
   * `core.invitation.expired`, `core.members.already_member`, `core.workspace.slug_taken` — passed
   * one that no client could ever see, and so did the entitlement errors. A client that wants to
   * say why in the reader's own language has nothing else to key on: the message is English prose
   * the server wrote, and matching on it is keeping a list of sentences in sync with a server you
   * do not ship with.
   */
  it('carries the reason to the client, which is the only part a client can translate', () => {
    const orpc = kernErrorToORPC(KernError.conflict('You are not clocked in.', 'not_clocked_in')) as {
      code: string
      message: string
      data: unknown
    }
    expect(orpc.code).toBe('CONFLICT')
    expect(orpc.message).toBe('You are not clocked in.')
    expect(orpc.data).toEqual({ reason: 'not_clocked_in' })
  })

  it('keeps details beside the reason rather than replacing them', () => {
    const err = new KernError('CONFLICT', 'Seat limit reached', { limit: 25 }, 'billing.seats.limit_reached')
    const orpc = kernErrorToORPC(err) as { data: unknown }
    expect(orpc.data).toEqual({ reason: 'billing.seats.limit_reached', limit: 25 })
  })

  it('leaves data undefined when there is neither, rather than sending an empty object', () => {
    const orpc = kernErrorToORPC(KernError.conflict('Just a sentence.')) as { data: unknown }
    expect(orpc.data).toBeUndefined()
  })

  it('passes anything that is not a KernError straight through', () => {
    const plain = new Error('boom')
    expect(kernErrorToORPC(plain)).toBe(plain)
  })
})

/**
 * Who may set `X-Forwarded-For`.
 *
 * The old value was `trustProxy: true`, which believes every hop — so `req.ip` was whatever the
 * caller wrote in the header, and the per-IP rate limit was keyed on something the caller chose.
 */
describe('trustProxyFrom', () => {
  it('defaults to loopback and the private ranges, where Caddy actually sits', () => {
    expect(trustProxyFrom(undefined)).toEqual(DEFAULT_TRUSTED_PROXIES)
    expect(trustProxyFrom('')).toEqual(DEFAULT_TRUSTED_PROXIES)
  })

  it('takes a list of addresses, CIDRs or named ranges', () => {
    expect(trustProxyFrom('10.0.0.0/8, 172.16.0.0/12')).toEqual(['10.0.0.0/8', '172.16.0.0/12'])
    expect(trustProxyFrom('loopback')).toEqual(['loopback'])
  })

  it('trusts nothing when asked to, for a service with no proxy in front', () => {
    expect(trustProxyFrom('none')).toBe(false)
    expect(trustProxyFrom('0')).toBe(false)
  })

  it('never resolves to "trust everything", whatever it is handed', () => {
    for (const v of ['true', 'yes', ' , , ', 'TRUE']) expect(trustProxyFrom(v)).not.toBe(true)
  })

  /**
   * The parse is the easy half; the wiring is what was actually wrong. A module route is the
   * cheapest way to ask the server what it decided `req.ip` was.
   */
  describe('reaches the server', () => {
    const ipModule = defineServerModule({
      definition: defineModule({ id: 'peer', name: 'Peer', version: '0.0.0' }),
      httpRoutes: [{ method: 'GET', path: '/ip', handler: async ({ request }) => ({ ip: request.ip }) }],
    })
    const askIp = async (trustedProxies?: string) => {
      const server = await listen(
        stubKernel({ moduleEnabled: true, modules: [ipModule], trustedProxies }),
        member,
      )
      try {
        const res = await fetch(`${server.url}/api/peer/ip`, {
          headers: { 'x-forwarded-for': '203.0.113.9' },
        })
        return ((await res.json()) as { ip: string }).ip
      } finally {
        await server.app.close()
      }
    }

    it('ignores a forged header when nothing is trusted', async () => {
      expect(await askIp('none')).toBe('127.0.0.1')
    })

    it('reads it from a peer that is trusted — which loopback is by default', async () => {
      // The test client *is* the trusted proxy here, which is the only way to exercise the
      // believing branch from a single machine. The point being asserted is that the setting is
      // consulted at all: the same request answers differently under the two configurations.
      expect(await askIp(undefined)).toBe('203.0.113.9')
    })
  })
})

/**
 * The per-IP limiter's exemption.
 *
 * It was `req.headers['x-kern-service'] !== undefined` — the *presence* of the header, with the
 * resolver that would reject a bad token not running until the route handler. So one header lifted
 * the limit for anybody who typed it. Only a token that verifies is exempt now.
 */
describe('the rate-limit allowList', () => {
  const hammer = (server: Server, headers: Record<string, string>) =>
    fetch(`${server.url}/api/health`, { headers })

  it('exempts a service whose credential verifies', async () => {
    const server = await listen(stubKernel({ moduleEnabled: true, serviceTokens: ['good-token'] }), member, {
      max: 2,
    })
    try {
      for (let i = 0; i < 5; i++) {
        const res = await hammer(server, { 'x-kern-service': 'good-token' })
        expect(res.status).toBe(200)
      }
    } finally {
      await server.app.close()
    }
  })

  it('does not exempt a header that is merely present', async () => {
    const server = await listen(stubKernel({ moduleEnabled: true, serviceTokens: ['good-token'] }), member, {
      max: 2,
    })
    try {
      const statuses: number[] = []
      for (let i = 0; i < 5; i++)
        statuses.push((await hammer(server, { 'x-kern-service': 'not-a-real-token' })).status)
      expect(statuses).toContain(429)
    } finally {
      await server.app.close()
    }
  })
})

/**
 * `apiRateLimit` — the entitlement key that had no enforcement site at all.
 *
 * The verdict itself is `WorkspaceApiBudget`'s (see `ratelimit.test.ts`); what is checked here is
 * that `workspaceScoped` asks, and that a refusal reaches the client as a 429 carrying a reason it
 * can translate rather than a 500.
 */
describe('the per-workspace API budget', () => {
  it('answers 429 with the plan and the limit when the workspace is over budget', async () => {
    const server = await listen(
      stubKernel({
        moduleEnabled: true,
        budget: { ok: false, limit: 60, used: 61, plan: 'Team', retryAfterSec: 12 },
      }),
      member,
    )
    try {
      const res = await rest(server, '/widgets/get')
      expect(res.status).toBe(429)
      const body = (await res.json()) as { code?: string; data?: Record<string, unknown> }
      expect(body.code).toBe('RATE_LIMITED')
      expect(body.data).toMatchObject({ reason: 'billing.api_rate.limit_reached', limit: 60, plan: 'Team' })
    } finally {
      await server.app.close()
    }
  })

  it('lets everything through when nothing bills, which is every self-hosted instance', async () => {
    const res = await rest(enabled, '/widgets/get')
    expect(res.status).toBe(200)
  })
})

/**
 * An operator crossing into a workspace they are not a member of.
 *
 * `workspaceScoped` has always let an instance admin through, which is right — support has to be
 * able to fix a tenant's workspace. What was wrong is that it left no trace: the request was
 * indistinguishable from the customer's own.
 */
describe('the unscoped-access signal', () => {
  it('records who, which workspace and which procedure', async () => {
    const crossings: UnscopedAccess[] = []
    const server = await listen(stubKernel({ moduleEnabled: true, crossings }), admin)
    try {
      expect((await rest(server, '/widgets/get')).status).toBe(200)
      expect(crossings).toHaveLength(1)
      expect(crossings[0]).toMatchObject({
        workspaceId: WORKSPACE,
        procedure: 'widgets.get',
        via: 'instance_admin',
        principal: { email: 'operator@example.test' },
      })
      expect(crossings[0]?.requestId).toBeTruthy()
    } finally {
      await server.app.close()
    }
  })

  it('says nothing about a member reaching their own workspace', async () => {
    const crossings: UnscopedAccess[] = []
    const server = await listen(stubKernel({ moduleEnabled: true, crossings }), member)
    try {
      expect((await rest(server, '/widgets/get')).status).toBe(200)
      expect(crossings).toEqual([])
    } finally {
      await server.app.close()
    }
  })

  it('cannot fail the request when the sink throws', async () => {
    const kernel = stubKernel({ moduleEnabled: true })
    kernel.unscopedAccess.on(() => {
      throw new Error('the audit sink is down')
    })
    const server = await listen(kernel, admin)
    try {
      expect((await rest(server, '/widgets/get')).status).toBe(200)
    } finally {
      await server.app.close()
    }
  })
})

/**
 * A module registering a raw-body HTTP route.
 *
 * `module-billing`'s Stripe webhook verifies a signature over the exact bytes that were sent, so a
 * body Fastify has parsed and something has re-encoded proves nothing. A module cannot reach the
 * Fastify instance — `extend` belongs to the service — so `httpRoutes` is how it asks.
 */
describe('a module http route', () => {
  const seen: { body?: unknown; contentType?: string } = {}
  const webhookModule = defineServerModule({
    definition: defineModule({ id: 'hooks', name: 'Hooks', version: '0.0.0' }),
    httpRoutes: [
      {
        method: 'POST',
        path: '/webhooks/stripe',
        raw: true,
        handler: async ({ request, body }) => {
          seen.body = body
          seen.contentType = request.headers['content-type']
          return { received: true, signature: request.headers['x-signature'] ?? null }
        },
      },
    ],
    // a module with a router as well, to prove the oRPC wildcard does not swallow the static path
    router,
  })

  // Exactly the bytes a signature would be computed over: key order and spacing preserved, which is
  // what a re-encode would quietly change.
  const PAYLOAD = '{"b":1,  "a":2}'

  let server: Server
  beforeAll(async () => {
    server = await listen(stubKernel({ moduleEnabled: true, modules: [webhookModule] }), ANONYMOUS)
  })
  afterAll(async () => {
    await server?.app.close()
  })

  it('is reachable under the module prefix and gets the unparsed bytes', async () => {
    const res = await fetch(`${server.url}/api/hooks/webhooks/stripe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-signature': 't=1,v1=abc' },
      body: PAYLOAD,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, signature: 't=1,v1=abc' })
    expect(Buffer.isBuffer(seen.body)).toBe(true)
    expect((seen.body as Buffer).toString('utf8')).toBe(PAYLOAD)
  })

  it('does not disturb the oRPC routes beside it, which need their own parser', async () => {
    // The raw parser is registered in an encapsulated scope. Registered on the instance instead, it
    // would replace the pass-through parser oRPC needs and every body would arrive as undefined.
    const res = await fetch(`${server.url}/api/hooks/rpc/widgets/get`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ json: { workspaceId: WORKSPACE }, meta: [] }),
    })
    expect(res.status).toBe(401)
  })
})

/**
 * A suspended workspace is read-only, and that is enforced here or nowhere.
 *
 * `Entitlements.requireActive` shipped with no caller anywhere in Kern, so `active: false` reached
 * a banner on the billing screen and nothing else — a workspace that had stopped paying, or had
 * been suspended by an operator, kept every write it ever had. ADR 0003 §6 is the contract these
 * assertions hold the gate to: writes stop, reading and exporting never do, and nothing is deleted.
 *
 * The three fall-open cases matter as much as the refusal. Getting one of them wrong turns every
 * self-hosted instance, or a five-minute billing outage, into a read-only product.
 */
describe('a workspace whose subscription no longer entitles it', () => {
  const SUSPENDED = { active: false, planName: 'Team' } as Partial<Entitlement>

  let suspended: Server
  let cancelledService: Server
  let selfHosted: Server
  let billerDown: Server
  let paying: Server

  beforeAll(async () => {
    suspended = await listen(stubKernel({ moduleEnabled: true, billing: SUSPENDED }), member)
    cancelledService = await listen(stubKernel({ moduleEnabled: true, billing: SUSPENDED }), service)
    // no billing module anywhere: `mightAnswer` is false and nothing is even asked
    selfHosted = await listen(stubKernel({ moduleEnabled: true }), member)
    billerDown = await listen(stubKernel({ moduleEnabled: true, billing: 'unreachable' }), member)
    paying = await listen(
      stubKernel({ moduleEnabled: true, billing: { active: true, planName: 'Team' } }),
      member,
    )
  })
  afterAll(async () => {
    await Promise.all([
      suspended?.app.close(),
      cancelledService?.app.close(),
      selfHosted?.app.close(),
      billerDown?.app.close(),
      paying?.app.close(),
    ])
  })

  it('refuses a write, and says which plan it is about', async () => {
    const res = await rest(suspended, '/widgets/get')
    expect(res.status).toBe(httpStatusFor('CONFLICT'))
    const body = (await res.json()) as { data?: { reason?: string; plan?: string }; message?: string }
    // an honest reason code, so the shell can offer the one action that fixes it rather than a
    // generic failure toast
    expect(body.data?.reason).toBe('billing.subscription.inactive')
    expect(body.data?.plan).toBe('Team')
  })

  it('refuses it over the RPC surface with the same code', async () => {
    const res = await rpc(suspended, 'widgets/get')
    expect(res.status).toBe(httpStatusFor('CONFLICT'))
    const body = (await res.json()) as { json?: { code?: string; data?: { reason?: string } } }
    expect(body.json?.code).toBe('CONFLICT')
    expect(body.json?.data?.reason).toBe('billing.subscription.inactive')
  })

  it('still serves a read over REST', async () => {
    const res = await restGet(suspended, '/widgets/read')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  /**
   * The assertion the whole design turns on. `/rpc/*` is POST for everything, reads included, so a
   * gate keyed on the request's method would refuse this — and a suspended workspace would be
   * unreadable in the app while remaining readable through curl.
   */
  it('still serves that same read over RPC, where the wire method is POST', async () => {
    const res = await rpc(suspended, 'widgets/read')
    expect(res.status).toBe(200)
    expect(((await res.json()) as { json?: unknown }).json).toEqual({ ok: true })
  })

  it('lets a write marked `allowWhileSuspended` through — this is how a customer pays', async () => {
    // billing's `checkout` and `portal` are POSTs whose entire purpose is to end the suspension,
    // and core's export is a POST the ADR promises always works
    const res = await rest(suspended, '/widgets/pay')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('does not exempt the procedures beside it', async () => {
    // the marker is per-procedure on purpose: `/widgets/pay` being exempt must not quietly cover
    // everything else in the same router
    expect((await rest(suspended, '/widgets/get')).status).toBe(httpStatusFor('CONFLICT'))
  })

  it('leaves a service principal alone', async () => {
    const res = await rest(cancelledService, '/widgets/get')
    expect(res.status).toBe(200)
  })

  it('never refuses anything when nothing bills — every self-hosted instance', async () => {
    expect((await rest(selfHosted, '/widgets/get')).status).toBe(200)
    expect((await rpc(selfHosted, 'widgets/get')).status).toBe(200)
  })

  it('never refuses anything when the biller cannot be reached', async () => {
    // a billing outage must not turn a paying customer's workspace read-only
    expect((await rest(billerDown, '/widgets/get')).status).toBe(200)
  })

  it('leaves a workspace that is paying exactly as it was', async () => {
    expect((await rest(paying, '/widgets/get')).status).toBe(200)
  })
})

/**
 * The exemption is convention at the procedure level and mechanism nowhere.
 *
 * `reachableWhileSuspended` looks for the marker anywhere in a procedure's middleware list, and oRPC
 * copies a builder's middlewares into every procedure derived from it. So `allowWhileSuspended`
 * applied once to a shared base — the ordinary way anyone would avoid repeating `workspaceScoped` —
 * exempts every procedure built from that base, including ones written months later by someone who
 * never saw the `.use`. Nothing warns; the gate simply stops applying to a whole router.
 *
 * This is asserted rather than fixed because the marker cannot tell where it was applied: by the
 * time the gate reads the list, a per-procedure `.use` and an inherited one are the same entry. The
 * test exists so the edge is discoverable from the test suite instead of being found in production,
 * and so that a future mechanism which *does* close it has something to flip.
 */
describe('the read-only gate: how a router-level exemption escapes', () => {
  it('inherits the marker into every procedure built from a shared base', () => {
    // the ordinary way somebody avoids repeating `workspaceScoped` on every procedure
    const lax = o.use(workspaceScoped('demo')).use(allowWhileSuspended)
    const meantToBeExempt = lax
      .route({ method: 'POST', path: '/lax/pay' })
      .input(Input)
      .output(Output)
      .handler(async () => ({ ok: true }))
    // written later, by someone who never saw the `.use` above
    const neverMarked = lax
      .route({ method: 'POST', path: '/lax/delete-everything' })
      .input(Input)
      .output(Output)
      .handler(async () => ({ ok: true }))

    const READ_ONLY_SAFE = Symbol.for('kern.http.readOnlySafe')
    const carriesMarker = (p: unknown) =>
      (p as { '~orpc': { middlewares: readonly unknown[] } })['~orpc'].middlewares.some(
        (m) => (m as Record<symbol, unknown>)[READ_ONLY_SAFE] === true,
      )

    expect(carriesMarker(meantToBeExempt)).toBe(true)
    // the whole point: this one is exempt too, and nothing in its own definition says so
    expect(carriesMarker(neverMarked)).toBe(true)
  })
})
