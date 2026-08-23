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
import { httpStatusFor, KernError } from './errors.js'
import { createHttpServer, kernErrorToORPC, o, workspaceScoped } from './http.js'
import type { Kernel } from './kernel.js'
import { defineModule, defineServerModule } from './module.js'
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
  },
})

const demoModule = defineServerModule({
  definition: defineModule({ id: 'demo', name: 'Demo', version: '0.0.0' }),
  router,
})

/**
 * Only the handful of kernel surfaces `createHttpServer` touches. A real kernel would need Postgres,
 * which this package's tests deliberately do without.
 */
function stubKernel(opts: { moduleEnabled: boolean }): Kernel {
  const noop = () => {}
  return {
    service: 'test',
    version: '0.0.0',
    registry: new ModuleRegistry([demoModule]),
    log: { info: noop, warn: noop, error: noop, debug: noop, fatal: noop, trace: noop },
    database: { pool: { query: async () => ({ rows: [] }) } },
    authz: { requireMember: noop },
    // the request hook asks on every request whether the instance is closed for an upgrade
    maintenance: { active: async () => null },
    isModuleEnabled: async () => opts.moduleEnabled,
  } as unknown as Kernel
}

interface Server {
  url: string
  app: FastifyInstance
}

async function listen(kernel: Kernel, principal: Principal): Promise<Server> {
  const app = await createHttpServer({
    kernel,
    resolvePrincipal: async () => principal,
    corsOrigins: ['http://localhost'],
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

beforeAll(async () => {
  enabled = await listen(stubKernel({ moduleEnabled: true }), member)
  disabled = await listen(stubKernel({ moduleEnabled: false }), member)
  anonymous = await listen(stubKernel({ moduleEnabled: true }), ANONYMOUS)
})
afterAll(async () => {
  await Promise.all([enabled?.app.close(), disabled?.app.close(), anonymous?.app.close()])
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
