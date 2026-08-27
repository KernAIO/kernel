import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { ANONYMOUS, type Principal } from '@kernhq/contracts'
import { OpenAPIGenerator } from '@orpc/openapi'
import { OpenAPIHandler } from '@orpc/openapi/node'
import { ORPCError, onError, os } from '@orpc/server'
import { RPCHandler } from '@orpc/server/node'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import { httpStatusFor, KernError } from './errors.js'
import type { Kernel } from './kernel.js'

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
 * Middleware factory: require active membership in `input.workspaceId` and that `moduleId` is enabled there.
 * Input is typed `unknown` so the middleware can be applied at router level, where oRPC cannot prove
 * every procedure's input shape; each procedure behind it must take `{ workspaceId }`.
 */
export const workspaceScoped = (moduleId?: string) =>
  o.middleware(async ({ context, next }, input) => {
    const { workspaceId } = input as { workspaceId: string }
    const { kernel, principal } = context
    if (principal.kind === 'anonymous') throw new ORPCError('UNAUTHORIZED')
    if (typeof workspaceId !== 'string')
      throw new ORPCError('BAD_REQUEST', { message: 'workspaceId required' })
    if (!principal.instanceAdmin && principal.kind !== 'service')
      kernel.authz.requireMember(principal, workspaceId)
    if (moduleId && !(await kernel.isModuleEnabled(workspaceId, moduleId)))
      // `MODULE_DISABLED` is ours, not one of oRPC's standard codes, so oRPC has no status to fall
      // back on and would answer 500. Every Kern-specific code has to carry its status explicitly.
      throw new ORPCError('MODULE_DISABLED', {
        message: `Module ${moduleId} is disabled in this workspace`,
        data: { module: moduleId },
        status: httpStatusFor('MODULE_DISABLED'),
      })
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

export type PrincipalResolver = (req: FastifyRequest, kernel: Kernel) => Promise<Principal>

export interface HttpOptions {
  kernel: Kernel
  resolvePrincipal: PrincipalResolver
  corsOrigins: string[]
  /** extra Fastify setup (Better Auth handler, tus, webhooks, websockets…) */
  extend?: (app: FastifyInstance) => Promise<void> | void
  openapi?: { title: string; version: string; description?: string }
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
     * `true` trusts *every* proxy rather than a named hop, so Fastify takes the client address from
     * `X-Forwarded-For` whoever sent it. Measured: a forged header on a socket from `10.0.0.5`
     * yields `req.ip === '203.0.113.9'`. That is correct for a log line and for rate-limit
     * bucketing, which is all anything does with it today, and wrong for anything that decides
     * access — an IP allowlist built on this is defeated by one header, which is worse than no
     * allowlist because an administrator believes it pins requests to their office.
     *
     * `module-hr` declined to ship an office IP allowlist for exactly this reason. Before anything
     * gates on `ip`, this has to become a hop count or a CIDR list, and that changes client-address
     * semantics for every service at once — so it is a deliberate change with a deployment story,
     * not a line somebody tightens in passing.
     */
    trustProxy: true,
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
    max: 600,
    timeWindow: '1 minute',
    allowList: (req) => req.headers['x-kern-service'] !== undefined,
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
    if (!mod.router) continue
    const prefix = `/api/${mod.definition.apiPrefix ?? mod.definition.id}`
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
