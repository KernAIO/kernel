import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { ANONYMOUS, type Principal } from '@kernhq/contracts'
import { OpenAPIGenerator } from '@orpc/openapi'
import { OpenAPIHandler } from '@orpc/openapi/node'
import { ORPCError, onError, os } from '@orpc/server'
import { RPCHandler } from '@orpc/server/node'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  type HTTPMethods,
} from 'fastify'
import type { UnscopedAccess } from './access-signal.js'
import { httpStatusFor, KernError } from './errors.js'
import type { Kernel } from './kernel.js'
import type { ModuleHttpRoute } from './module.js'

/** Context every oRPC procedure receives. */
export interface RequestContext {
  kernel: Kernel
  principal: Principal
  requestId: string
  ip: string
  headers: Record<string, string | string[] | undefined>
  /** set by per-workspace routes after membership + module checks */
  workspaceId?: string
}

/** Base oRPC builder with the Kern context type – modules build their routers from this. */
export const o = os.$context<RequestContext>()

/** Middleware: require an authenticated user (or API key / service). */
export const authed = o.middleware(async ({ context, next }) => {
  if (context.principal.kind === 'anonymous') throw new ORPCError('UNAUTHORIZED')
  return next()
})

/**
 * Contract methods that only read, and are therefore reachable in a suspended workspace.
 *
 * **Read off the contract, never off the wire.** Every oRPC call arrives over the binary protocol
 * as `POST /api/<module>/rpc/...`, so a gate that asked the HTTP request what method it was would
 * classify every read in Kern as a write and make a suspended workspace unreadable — the exact
 * opposite of what suspension means. `procedure['~orpc'].route.method` is what the module declared,
 * and it is the same value whether the call came over RPC or REST.
 *
 * A procedure with no declared method counts as a write. That is the safe direction: a new
 * procedure is refused in a suspended workspace until somebody says otherwise, rather than being
 * quietly exempt.
 */
const READING_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Marks the middleware below, so `workspaceScoped` can find it in a procedure's middleware list. */
const READ_ONLY_SAFE = Symbol.for('kern.http.readOnlySafe')

/**
 * Let one writing procedure through in a suspended workspace.
 *
 * A suspended workspace is read-only, and two kinds of write have to survive that or suspension
 * becomes a trap:
 *
 * - **Paying.** `billing.subscription.checkout` and `.portal` are both `POST`, and they are the two
 *   procedures whose entire purpose is to end the suspension. Gating them means the customer who is
 *   trying to give you money is the one person who cannot, and only an operator can let them out.
 * - **Leaving.** ADR 0003 §6: a customer who has stopped paying "can always still read and export
 *   what is theirs". An export is a job somebody starts, so it is a `POST` that must not be gated.
 *
 * Put it on the procedure, beside `requires(...)`:
 *
 * ```ts
 * checkout: scoped.subscription.checkout
 *   .use(allowWhileSuspended)
 *   .use(requires(BILLING_PERMISSIONS.manage))
 *   .handler(...)
 * ```
 *
 * Order does not matter — `workspaceScoped` reads the procedure's whole middleware list, not the
 * ones that have run so far — but the exemption is deliberately per-procedure and never per-router:
 * a router-level exemption would silently cover every procedure added to that router afterwards.
 *
 * It exempts a procedure from the **subscription** gate only. Membership, permissions, capabilities
 * and the per-workspace API budget all still apply.
 */
export const allowWhileSuspended = Object.defineProperty(
  o.middleware(async ({ next }) => next()),
  READ_ONLY_SAFE,
  { value: true },
)

/** Whether this procedure may run in a workspace whose subscription no longer entitles it. */
function reachableWhileSuspended(procedure: {
  '~orpc': { route: { method?: string }; middlewares: readonly unknown[] }
}): boolean {
  const def = procedure['~orpc']
  if (READING_METHODS.has(def.route.method ?? 'POST')) return true
  return def.middlewares.some((m) => (m as Record<symbol, unknown>)[READ_ONLY_SAFE] === true)
}

/**
 * Middleware factory: require active membership in `input.workspaceId` and that `moduleId` is enabled there.
 * Input is typed `unknown` so the middleware can be applied at router level, where oRPC cannot prove
 * every procedure's input shape; each procedure behind it must take `{ workspaceId }`.
 */
export const workspaceScoped = (moduleId?: string) =>
  o.middleware(async ({ context, next, path, procedure }, input) => {
    const { workspaceId } = input as { workspaceId: string }
    const { kernel, principal } = context
    if (principal.kind === 'anonymous') throw new ORPCError('UNAUTHORIZED')
    if (typeof workspaceId !== 'string')
      throw new ORPCError('BAD_REQUEST', { message: 'workspaceId required' })
    if (!principal.instanceAdmin && principal.kind !== 'service')
      kernel.authz.requireMember(principal, workspaceId)
    // An instance admin or a service reaching a workspace it is not in is legitimate and has to
    // leave a trace: support opening a customer's data used to be indistinguishable from the
    // customer opening it. Fire-and-forget by construction — see `UnscopedAccessSignal`.
    else recordUnscopedAccess(context, workspaceId, path)
    /**
     * The one place `apiRateLimit` is enforced.
     *
     * Per workspace, so one tenant's runaway integration cannot spend the instance's capacity, and
     * measured against what that workspace's plan actually allows. Unlimited when nothing bills —
     * which is every self-hosted instance, and costs no I/O — and never able to refuse for a reason
     * of its own: an unreachable Valkey lets the request through.
     *
     * After the membership check on purpose: a stranger must not be able to spend a workspace's
     * budget. Service principals are exempt because internal traffic is not the customer's API use.
     */
    if (principal.kind !== 'service') {
      const verdict = await kernel.apiBudget.check(workspaceId)
      if (!verdict.ok)
        throw new ORPCError('RATE_LIMITED', {
          message: verdict.plan
            ? `This workspace's ${verdict.plan} plan allows ${verdict.limit} API requests a minute`
            : `This workspace is limited to ${verdict.limit} API requests a minute`,
          data: {
            reason: 'billing.api_rate.limit_reached',
            limit: verdict.limit,
            plan: verdict.plan,
            retryAfter: verdict.retryAfterSec,
          },
          status: httpStatusFor('RATE_LIMITED'),
        })
    }
    if (moduleId && !(await kernel.isModuleEnabled(workspaceId, moduleId)))
      // `MODULE_DISABLED` is ours, not one of oRPC's standard codes, so oRPC has no status to fall
      // back on and would answer 500. Every Kern-specific code has to carry its status explicitly.
      throw new ORPCError('MODULE_DISABLED', {
        message: `Module ${moduleId} is disabled in this workspace`,
        data: { module: moduleId },
        status: httpStatusFor('MODULE_DISABLED'),
      })
    /**
     * The one place a suspended workspace becomes read-only.
     *
     * `Entitlements.requireActive` existed for months with **no caller anywhere**, so `active:
     * false` reached a banner on the billing screen and nothing else: a workspace whose
     * subscription had been cancelled or suspended kept full write access, which is the thing
     * suspension is for. ADR 0003 §6 says read and export always keep working, and that is what
     * `reachableWhileSuspended` decides above.
     *
     * It **falls open** three ways, on purpose, because refusing a write for a billing reason that
     * is not true is far worse than allowing one:
     *
     * - `source: 'none'` — nothing bills in this instance. Every self-hosted Kern, every request.
     * - `source: 'unavailable'` — a biller exists and did not answer. A billing outage must never
     *   turn a customer's workspace read-only.
     * - a service principal — internal traffic is not the customer spending their subscription.
     *
     * The first two are already `active: true` in `UNLIMITED`, so `requireActive` would let them
     * through on its own; asking `source` first says out loud that they are meant to, and is what a
     * later change to `active` has to get past.
     */
    if (principal.kind !== 'service' && !reachableWhileSuspended(procedure)) {
      const ent = await kernel.entitlements.of(workspaceId)
      if (ent.source === 'plan') await kernel.entitlements.requireActive(workspaceId)
    }
    return next({ context: { ...context, workspaceId } })
  })
/**
 * Middleware factory: require that a capability of `moduleId` is on in `input.workspaceId`.
 *
 * The answer is **404, not 403**, and that is the whole point. A permission failure says "this
 * exists and you may not have it", which is right for a person without a role and wrong for a
 * workspace that never bought the feature — it leaks a surface, and it turns a menu the shell
 * already hid into a promise the API breaks. A disabled capability is simply not part of this
 * workspace's API, so it answers like anything else that is not there.
 *
 * Goes on every procedure belonging to a capability, beside `workspaceScoped` and `requires`. Input
 * is typed `unknown` for the same reason `workspaceScoped` is: it may be applied at router level.
 */
export const requiresCapability = (moduleId: string, capability: string) =>
  o.middleware(async ({ context, next }, input) => {
    const { workspaceId } = input as { workspaceId: string }
    if (typeof workspaceId !== 'string')
      throw new ORPCError('BAD_REQUEST', { message: 'workspaceId required' })
    const on = await context.kernel.capabilities(workspaceId, moduleId)
    if (!on.has(capability))
      // "not available", not "not enabled" — the resolved set is a *closure*, so a capability drops
      // out either because its own switch is off or because something it depends on is, and this
      // middleware cannot tell which: it is handed the answer, not the working. Saying "not enabled"
      // sent an administrator to look at a switch that was plainly on, and then to toggle a setting
      // that was already correct. Measured on `hr.payroll_export`, which depends on `attendance` and
      // `periods`: with either of those off, all three refusals read identically.
      //
      // Naming the missing dependency needs the module's declarations, which live in the registry
      // and are not reachable from here. Worth doing when something else needs `kernel` to expose
      // them; until then the honest sentence is the one that does not claim to know.
      throw new ORPCError('NOT_FOUND', {
        message: `${moduleId}.${capability} is not available in this workspace — it is switched off, or something it depends on is`,
      })
    return next()
  })

/**
 * Build and hand off the record for a principal that passed `workspaceScoped` without a membership.
 *
 * Deliberately does everything cheap here and nothing expensive: assembling the object is a few
 * property reads, and `record()` returns before any sink has finished. A `kernel` without the signal
 * — a stub in a test, an older service that has not been rebuilt — is skipped rather than throwing,
 * because failing a request to observe it would be the wrong way round.
 */
function recordUnscopedAccess(context: RequestContext, workspaceId: string, path: readonly string[]) {
  const { kernel, principal } = context
  if (!kernel.unscopedAccess) return
  const access: UnscopedAccess = {
    workspaceId,
    procedure: path.join('.'),
    via: principal.kind === 'service' ? 'service' : 'instance_admin',
    principal: {
      kind: principal.kind,
      userId: principal.userId ?? null,
      email: principal.email ?? null,
      service: principal.service ?? null,
    },
    requestId: context.requestId,
    ip: context.ip,
    at: new Date().toISOString(),
  }
  kernel.unscopedAccess.record(access)
}

/** Middleware factory: require a permission at workspace scope. */
export const requires = (permission: string) =>
  o.middleware(async ({ context, next }, input: { workspaceId: string }) => {
    await context.kernel.authz.require(context.principal, permission, {
      kind: 'workspace',
      id: input.workspaceId,
      workspaceId: input.workspaceId,
    })
    return next()
  })

/**
 * A `KernError` as the client will see it — including its `reason`, which used to stop here.
 *
 * `KernError` has carried a `reason` since it was written, and `conflict`, `notFound` and the
 * entitlement errors all take one: `core.invitation.expired`, `core.members.already_member`,
 * `billing.seats.limit_reached`. Only `details` was ever serialised, so every one of those was
 * dropped at the wire and no client could ever branch on one. Two years of call sites believed a
 * parameter that did nothing.
 *
 * It matters because a `reason` is the only thing a client can translate. The `message` is a
 * sentence the server wrote, in English, and a screen that renders it is showing English to a
 * Persian reader at exactly the moment they need the explanation; a screen that matches on it is
 * keeping a list of sentences in sync with a server it does not ship with. The reason is neither.
 *
 * Folded into `data` rather than sent beside it, because `data` is what oRPC already carries to the
 * client. `details` wins on a key collision — a caller that put its own `reason` in `details` meant
 * that one.
 */
export function kernErrorToORPC(err: unknown): unknown {
  if (err instanceof KernError)
    return new ORPCError(err.code, {
      message: err.message,
      data: err.reason ? { reason: err.reason, ...err.details } : err.details,
      status: httpStatusFor(err.code),
      cause: err,
    })
  return err
}

/** What Fastify is given for `trustProxy`: a list of trusted peers, or `false` for none. */
export type TrustProxySetting = string[] | false

/**
 * The peers Kern trusts to have written `X-Forwarded-For` when `TRUSTED_PROXIES` says nothing else:
 * loopback and the private ranges. That is where Caddy sits in all three shipped topologies — the
 * same set Caddy itself is told to trust with `trusted_proxies static private_ranges`.
 *
 * A request arriving straight from a public address is therefore not trusted, and `req.ip` is its
 * socket address no matter what header it sent.
 */
export const DEFAULT_TRUSTED_PROXIES = ['loopback', 'uniquelocal', 'linklocal']

/**
 * Turn `TRUSTED_PROXIES` into what Fastify wants: a comma-separated list of addresses, CIDRs, or
 * `proxy-addr`'s named ranges (`loopback`, `uniquelocal`, `linklocal`). `none`, `off` or `0` trust
 * nothing at all, which is right for a service exposed with no proxy in front.
 *
 * **A bare hop count is not accepted, and it is worth saying why**, because Fastify's documentation
 * offers one. Fastify 5.12 turns `trustProxy: 2` into a predicate that returns `false` for every
 * address — deliberately: a hop count cannot validate the immediate peer, so a client that sends
 * enough `X-Forwarded-For` entries of its own would be believed. A number here therefore trusts
 * *nothing* rather than the two hops it looks like it asks for, which is the safe direction and not
 * the one the operator meant. Naming the proxies is the only form that means anything, so it is the
 * only form this takes; anything unparseable falls back to the default rather than to `true`.
 */
export function trustProxyFrom(value: string | undefined): TrustProxySetting {
  const raw = (value ?? '').trim()
  if (!raw) return DEFAULT_TRUSTED_PROXIES
  if (/^(none|off|false|0)$/i.test(raw)) return false
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return list.length ? list : DEFAULT_TRUSTED_PROXIES
}

export type PrincipalResolver = (req: FastifyRequest, kernel: Kernel) => Promise<Principal>

export interface HttpOptions {
  kernel: Kernel
  resolvePrincipal: PrincipalResolver
  corsOrigins: string[]
  /**
   * Extra Fastify setup owned by **the service** — Better Auth's handler, tus, a websocket upgrade.
   * Runs last, after every module's routes are mounted, with the whole instance.
   *
   * A raw body here is `scope.addContentTypeParser('*', { parseAs: 'buffer' }, …)` inside
   * `app.register(async (scope) => …)`. Encapsulate it: a parser added on `app` itself replaces the
   * parsers for every route in the service, including the oRPC ones, and the symptom is every
   * request body arriving as `undefined`.
   *
   * **A module cannot use this** — it never sees the Fastify instance, and it must not import the
   * service that assembles it. A module that needs a raw-body route (a webhook whose signature
   * covers the exact bytes) declares `httpRoutes` on its `ServerModule` instead; see
   * `ModuleHttpRoute` in `module.ts` for the shape and the rules. That is the supported path, and it
   * is the one `module-billing`'s Stripe webhook uses.
   */
  extend?: (app: FastifyInstance) => Promise<void> | void
  openapi?: { title: string; version: string; description?: string }
  /**
   * The per-IP limit, which is about one caller flooding the service and is a different question
   * from the per-workspace budget `workspaceScoped` applies (that one is about a plan). Defaults to
   * 600 a minute.
   */
  rateLimit?: { max?: number; timeWindow?: string }
}

/**
 * Fastify server that mounts every hosted module's oRPC router at:
 *   /api/<prefix>/rpc/*   – oRPC binary protocol (used by the SvelteKit app via @kernhq/sdk)
 *   /api/<prefix>/*       – OpenAPI-style REST (3rd parties, curl, webhooks)
 *   /api/<prefix>/openapi.json
 */
export async function createHttpServer(opts: HttpOptions): Promise<FastifyInstance> {
  const { kernel } = opts
  const app = Fastify({
    logger: false,
    /**
     * **`context.ip` is a claim, not evidence, and nothing may make a security decision on it.**
     *
     * It used to be `true`, which trusts *every* hop: Fastify then took the client address from
     * `X-Forwarded-For` whoever sent it. Measured — a forged header on a socket from `10.0.0.5`
     * yielded `req.ip === '203.0.113.9'`. That made the per-IP rate limit keyed on a value the
     * caller picks, which is the same as having no per-IP rate limit: send a different address each
     * request and the bucket is always empty.
     *
     * Now it is a list of trusted peers from `TRUSTED_PROXIES` — loopback and the private ranges by
     * default, which is where Caddy sits in all three shipped topologies. The header is read only
     * when the socket's own peer is one of them, so `req.ip` is the address the proxy in front
     * observed, which is good enough to count with. It is still not good enough to *decide* with: an
     * operator can put anything in front of this, and a proxy that appends rather than replaces
     * still carries whatever the client sent. `module-hr` declined to ship an office IP allowlist
     * for that reason and the reason has not changed.
     */
    trustProxy: trustProxyFrom(kernel.env?.TRUSTED_PROXIES),
    bodyLimit: 25 * 1024 * 1024,
    genReqId: () => crypto.randomUUID(),
  })
  await app.register(helmet, {
    /*
     * A JSON API renders nothing, so it needs nothing: no scripts, no styles, no frames. Saying so
     * costs nothing and means an HTML error page — or an endpoint somebody adds later without
     * thinking about it — cannot execute anything or be framed.
     *
     * `/api/docs` is the one route that does render, and it relaxes this for itself.
     */
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'none'"],
        'form-action': ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
  await app.register(cors, {
    origin: opts.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
  await app.register(rateLimit, {
    max: opts.rateLimit?.max ?? 600,
    timeWindow: opts.rateLimit?.timeWindow ?? '1 minute',
    /**
     * Only a service credential that **verifies** is exempt.
     *
     * This used to be `req.headers['x-kern-service'] !== undefined`: the mere presence of the
     * header lifted the limit, and the resolver that would reject a bad token does not run until
     * the route handler. So `curl -H 'x-kern-service: x'` was unlimited, from any address, with no
     * credential of any kind. The token is an HS256 JWT over `KERN_SECRET` — the same one
     * `resolvePrincipal` checks a moment later — so verifying it here costs one symmetric
     * verification on the requests that carry it and nothing at all on the ones that do not.
     */
    allowList: async (req) => {
      const token = req.headers['x-kern-service']
      if (typeof token !== 'string' || !token) return false
      return (await kernel.auth?.verifyService(token).catch(() => null)) != null
    },
  })

  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-request-id', req.id)
    // during an upgrade the API says so, so the interface can show a maintenance screen instead of
    // turning half-applied migrations into a wall of 500s. Health and readiness stay answerable —
    // they are how the upgrade itself knows when the service is back.
    if (req.url.startsWith('/api/health') || req.url.startsWith('/api/ready')) return
    const state = await kernel.maintenance.active()
    if (state)
      return reply
        .status(503)
        .header('retry-after', '15')
        .send({ code: 'MAINTENANCE', message: state.reason, details: { since: state.since } })
  })
  app.addHook('onResponse', async (req, reply) => {
    if (req.url.startsWith('/api/health')) return
    kernel.log.info(
      {
        method: req.method,
        url: req.url,
        status: reply.statusCode,
        ms: Math.round(reply.elapsedTime),
        reqId: req.id,
      },
      'req',
    )
  })
  app.setErrorHandler((err: unknown, req, reply) => {
    const e = err instanceof KernError ? err : null
    const error = err as Error & { statusCode?: number }
    const status = e ? httpStatusFor(e.code) : (error.statusCode ?? 500)
    if (status >= 500) kernel.log.error({ err, reqId: req.id }, 'unhandled error')
    reply.status(status).send({
      code: e?.code ?? (status === 429 ? 'RATE_LIMITED' : 'INTERNAL'),
      message: status >= 500 ? 'Internal error' : error.message,
      details: e?.details,
    })
  })

  app.get('/api/health', async () => ({
    ok: true,
    service: kernel.service,
    version: kernel.version,
    // id *and* version: this is what the release-feed generator reads out of a built image, and
    // what the admin update screen diffs against the newest release
    modules: kernel.registry.all().map((m) => ({ id: m.definition.id, version: m.definition.version })),
  }))
  app.get('/api/ready', async (_req, reply) => {
    try {
      await kernel.database.pool.query('select 1')
      return { ok: true }
    } catch {
      return reply.status(503).send({ ok: false })
    }
  })

  const jsonSchema = new ZodToJsonSchemaConverter()
  const generator = new OpenAPIGenerator({ schemaConverters: [jsonSchema] })

  for (const mod of kernel.registry.all()) {
    const prefix = `/api/${mod.definition.apiPrefix ?? mod.definition.id}`
    // Before the oRPC wildcard, though the order does not actually matter: Fastify's router prefers
    // a static path over `${prefix}/*`, so the two cannot shadow each other.
    for (const route of mod.httpRoutes ?? [])
      await registerModuleRoute(app, kernel, mod.definition.id, prefix, route)
    if (!mod.router) continue
    const router = mod.router(kernel)
    // Translate domain errors into oRPC errors and make anything unexpected visible in the logs –
    // oRPC answers with a bare 500 otherwise, which is impossible to diagnose in production.
    const onProcedureError = (e: unknown) => {
      if (e instanceof KernError) throw kernErrorToORPC(e)
      if (e instanceof ORPCError) return
      kernel.log.error({ err: e, module: mod.definition.id }, 'unhandled error in module procedure')
    }
    const rpc = new RPCHandler(router, { interceptors: [onError(onProcedureError)] })
    const rest = new OpenAPIHandler(router, { interceptors: [onError(onProcedureError)] })
    const spec = await generator.generate(router, {
      info: {
        title: `${opts.openapi?.title ?? 'Kern'} – ${mod.definition.name}`,
        version: mod.definition.version,
        description: mod.definition.description,
      },
      servers: [{ url: prefix }],
      security: [{ bearerAuth: [] }],
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
    })
    app.get(`${prefix}/openapi.json`, async () => spec)
    // Module routes are registered in their own encapsulated scope with a pass-through body parser:
    // oRPC reads the raw request stream itself, so Fastify must not consume it first (otherwise every
    // request with a body arrives at the handler as `undefined`).
    await app.register(async (scope) => {
      scope.removeAllContentTypeParsers()
      scope.addContentTypeParser('*', (_req, payload, done) => done(null, payload))
      scope.all(`${prefix}/*`, async (req, reply) => {
        const principal = await opts.resolvePrincipal(req, kernel).catch(() => ANONYMOUS)
        const context: RequestContext = {
          kernel,
          principal,
          requestId: req.id,
          ip: req.ip,
          headers: req.headers as any,
        }
        const isRpc = req.url.startsWith(`${prefix}/rpc`)
        const handler = isRpc ? rpc : rest
        const { matched } = await handler.handle(req.raw, reply.raw, {
          prefix: (isRpc ? `${prefix}/rpc` : prefix) as `/${string}`,
          context,
        })
        if (!matched) reply.status(404).send({ code: 'NOT_FOUND', message: 'Route not found' })
        else reply.hijack()
      })
    })
    kernel.log.info({ module: mod.definition.id, prefix }, 'module routes mounted')
  }
  await opts.extend?.(app)
  return app
}

/**
 * Mount one `ModuleHttpRoute` in its own encapsulated Fastify scope.
 *
 * The scope is what makes `raw` safe: `removeAllContentTypeParsers` and `addContentTypeParser` are
 * encapsulated in Fastify, so a module asking for unparsed bytes changes nothing for the oRPC
 * routes beside it — or for another module's route, which may want the parsed body.
 *
 * `parseAs: 'buffer'` and a parser that hands the buffer straight back is what produces the exact
 * bytes the client sent. Anything that decodes and re-encodes — `JSON.parse` and back — breaks
 * every webhook signature, and breaks it in a way that looks like a wrong secret.
 */
async function registerModuleRoute(
  app: FastifyInstance,
  kernel: Kernel,
  moduleId: string,
  prefix: string,
  route: ModuleHttpRoute,
): Promise<void> {
  if (!route.path.startsWith('/'))
    throw new Error(
      `Module ${moduleId} declares an http route whose path does not start with "/": ${route.path}`,
    )
  const url = `${prefix}${route.path}`
  await app.register(async (scope) => {
    if (route.raw) {
      scope.removeAllContentTypeParsers()
      scope.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => done(null, body))
    }
    scope.route({
      method: route.method as HTTPMethods | HTTPMethods[],
      url,
      bodyLimit: route.bodyLimit,
      handler: async (request: FastifyRequest, reply: FastifyReply) =>
        route.handler({ kernel, request, reply, body: request.body }),
    })
  })
  kernel.log.info({ module: moduleId, url, raw: route.raw === true }, 'module http route mounted')
}
