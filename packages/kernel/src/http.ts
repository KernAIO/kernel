import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { ANONYMOUS, type Principal } from '@kernalo/contracts'
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
/** Middleware factory: require active membership in `input.workspaceId` and that `moduleId` is enabled there. */
export const workspaceScoped = (moduleId?: string) =>
  o.middleware(async ({ context, next }, input: { workspaceId: string }) => {
    const { kernel, principal } = context
    if (principal.kind === 'anonymous') throw new ORPCError('UNAUTHORIZED')
    if (!principal.instanceAdmin && principal.kind !== 'service')
      kernel.authz.requireMember(principal, input.workspaceId)
    if (moduleId && !(await kernel.isModuleEnabled(input.workspaceId, moduleId)))
      throw new ORPCError('MODULE_DISABLED', { data: { module: moduleId } })
    return next({ context: { ...context, workspaceId: input.workspaceId } })
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

export function kernErrorToORPC(err: unknown): unknown {
  if (err instanceof KernError)
    return new ORPCError(err.code, {
      message: err.message,
      data: err.details,
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
 *   /api/<prefix>/rpc/*   – oRPC binary protocol (used by the SvelteKit app via @kernalo/sdk)
 *   /api/<prefix>/*       – OpenAPI-style REST (3rd parties, curl, webhooks)
 *   /api/<prefix>/openapi.json
 */
export async function createHttpServer(opts: HttpOptions): Promise<FastifyInstance> {
  const { kernel } = opts
  const app = Fastify({
    logger: false,
    trustProxy: true,
    bodyLimit: 25 * 1024 * 1024,
    genReqId: () => crypto.randomUUID(),
  })
  await app.register(helmet, {
    contentSecurityPolicy: false,
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
    modules: kernel.registry.ids(),
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
    const rpc = new RPCHandler(router, {
      interceptors: [
        onError((e) => {
          if (e instanceof KernError) throw kernErrorToORPC(e)
        }),
      ],
    })
    const rest = new OpenAPIHandler(router, {
      interceptors: [
        onError((e) => {
          if (e instanceof KernError) throw kernErrorToORPC(e)
        }),
      ],
    })
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
    app.all(`${prefix}/*`, async (req, reply) => {
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
    kernel.log.info({ module: mod.definition.id, prefix }, 'module routes mounted')
  }
  await opts.extend?.(app)
  return app
}
