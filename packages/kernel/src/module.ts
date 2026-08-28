import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  CapabilityDef,
  core,
  EventDef,
  ModuleManifest,
  PermissionDef,
  Principal,
} from '@kernhq/contracts'
import type { ContractRouter } from '@orpc/contract'
import type { Router } from '@orpc/server'
import type { PgSchema } from 'drizzle-orm/pg-core'
import type { FastifyReply, FastifyRequest, HTTPMethods } from 'fastify'
import { satisfies as semverSatisfies } from 'semver'
import type { z } from 'zod'
import type { RequestContext } from './http.js'
import type { Kernel } from './kernel.js'

/** Handler for a subscribed event. Runs in the hosting service; errors are logged and retried by the bus when durable. */
export type EventHandler<P = unknown> = (
  event: import('@kernhq/contracts').EventEnvelope<P>,
  kernel: Kernel,
) => Promise<void> | void

export interface JobDef<TInput = unknown> {
  name: string
  schema?: z.ZodType<TInput>
  handler: (input: TInput, ctx: { kernel: Kernel; id: string; attempt: number }) => Promise<void>
  options?: {
    retryLimit?: number
    retryDelay?: number
    retryBackoff?: boolean
    expireInSeconds?: number
    singletonKey?: string
    teamSize?: number
  }
  /** cron expression to run on a schedule (input = {}) */
  cron?: string
}

export interface AutomationTriggerDef {
  key: string
  label: string
  event: string
  schema?: z.ZodTypeAny
}
export interface AutomationConditionDef {
  key: string
  label: string
  schema: z.ZodTypeAny
  evaluate: (
    input: unknown,
    ctx: { event: unknown; kernel: Kernel; workspaceId: string },
  ) => Promise<boolean> | boolean
}
export interface AutomationActionDef {
  key: string
  label: string
  schema: z.ZodTypeAny
  run: (
    input: unknown,
    ctx: { event: unknown; kernel: Kernel; workspaceId: string; actor: Principal },
  ) => Promise<unknown>
}

export interface SearchIndexer {
  /** object types this indexer covers */
  types: string[]
  /** (re)index a single object; return null to remove from the index */
  load: (workspaceId: string, id: string, kernel: Kernel) => Promise<core.SearchDocument | null>
  /** full reindex stream for a workspace */
  scan?: (workspaceId: string, kernel: Kernel) => AsyncIterable<core.SearchDocument>
}

/** Resolves an ObjectRef into something the UI/notifications can render (title, url, icon). */
export interface ObjectResolver {
  type: string
  resolve: (
    workspaceId: string,
    ids: string[],
    principal: Principal,
    kernel: Kernel,
  ) => Promise<
    Array<{ id: string; title: string; url: string; icon?: string | null; subtitle?: string | null } | null>
  >
}

/** What a module's raw HTTP handler is handed. */
export interface ModuleHttpContext {
  kernel: Kernel
  request: FastifyRequest
  reply: FastifyReply
  /**
   * The request body.
   *
   * A `raw` route gets a `Buffer` of exactly the bytes the client sent, with no parsing of any kind
   * — which is the only thing a webhook signature can be checked against, because re-encoding JSON
   * is not guaranteed to reproduce the bytes that were signed. Without `raw` it is whatever
   * Fastify's parsers made of it.
   */
  body: Buffer | unknown
}

/**
 * A plain HTTP route a module needs beside its oRPC surface.
 *
 * **This is only for routes oRPC genuinely cannot carry**, and in practice that means one thing:
 * an inbound webhook, where a third party picks the URL, the method, the content type and the
 * status codes, and where verifying the signature requires the unparsed body. Everything a Kern
 * client calls belongs in the module's `router`, which gets typing, the OpenAPI document, the SDK
 * and every middleware in this file for free — none of which a route here has.
 *
 * Mounted under the module's API prefix, so `{ path: '/webhooks/stripe' }` in `module-billing`
 * answers at `/api/billing/webhooks/stripe`. That is a static path and Fastify prefers it over the
 * `\/api\/billing\/*` wildcard the oRPC handler is mounted on, so the two do not collide.
 *
 * What still applies to a route registered here, because it is registered on the same server:
 * helmet, CORS, the per-IP rate limit, the maintenance gate (a webhook gets a 503 with `retry-after`
 * during an upgrade, which every sender retries), and `x-request-id`.
 *
 * What does **not** apply: no principal is resolved, no permission is checked, no workspace is
 * scoped. A route here authenticates its own caller — that is the whole reason it exists — and it
 * must do so before it touches the database. `kernel.database.withWorkspace` is how it then gets
 * the tenant context every RLS policy reads.
 *
 * ```ts
 * export default defineServerModule({
 *   definition,
 *   httpRoutes: [
 *     {
 *       method: 'POST',
 *       path: '/webhooks/stripe',
 *       raw: true,
 *       handler: async ({ kernel, request, reply, body }) => {
 *         const signature = request.headers['stripe-signature']
 *         if (typeof signature !== 'string') return reply.status(400).send({ error: 'no signature' })
 *         const result = await handleWebhook(kernel, body as Buffer, signature)
 *         return { received: true, ...result }
 *       },
 *     },
 *   ],
 * })
 * ```
 *
 * A **service** that needs the same thing — Better Auth's handler, tus, a websocket upgrade — does
 * not use this; it passes `extend` to `createHttpServer` and has the whole Fastify instance. The
 * difference is ownership: `extend` belongs to whoever assembles the service, `httpRoutes` travels
 * with the module, so deleting the module removes the route too.
 */
export interface ModuleHttpRoute {
  method: HTTPMethods | HTTPMethods[]
  /** path under the module's API prefix; must start with `/` */
  path: string
  /** hand the handler the exact bytes the client sent, unparsed, as a `Buffer` */
  raw?: boolean
  /** bytes accepted on this route; defaults to the server's own limit */
  bodyLimit?: number
  /** return a value to send it as JSON, or use `reply` and return it */
  handler: (ctx: ModuleHttpContext) => Promise<unknown> | unknown
}

export interface ModuleDefinition<TSettings extends z.ZodTypeAny = z.ZodTypeAny> {
  id: string
  name: string
  version: string
  description?: string
  icon?: string
  core?: boolean
  dependsOn?: string[]
  /**
   * Semver range of the platform (`KERN_VERSION`) this module runs on. The kernel refuses to boot
   * when the running version does not satisfy it, so a mismatched custom build fails at start-up
   * with a readable message instead of at some unrelated call site later.
   */
  minKernel?: string
  defaultHost?: 'core' | 'chat' | 'mail' | 'collab' | string
  apiPrefix?: string
  permissions?: readonly PermissionDef[]
  /**
   * Sub-features a workspace may switch off inside this module, declared with `defineCapabilities`.
   *
   * A capability is not a second permission system: a permission asks whether *this person* may do
   * something, a capability asks whether *this workspace* has the feature at all. A procedure behind
   * a disabled capability answers `notFound`, not `forbidden`, and the shell drops its navigation,
   * widgets and commands — so a workspace that does not use a feature never meets it.
   */
  capabilities?: readonly CapabilityDef[]
  events?: Record<string, EventDef>
  notificationTypes?: core.NotificationTypeDef[]
  objectTypes?: Array<{ type: string; label: string; icon?: string; channelable?: boolean }>
  settings?: TSettings
}

export interface ServerModule<TSettings extends z.ZodTypeAny = z.ZodTypeAny> {
  definition: ModuleDefinition<TSettings>
  /** Drizzle schema object (`pgSchema('mod_<id>')`) + tables; the kernel grants/creates the schema */
  schema?: PgSchema
  /** absolute path to the module's drizzle migrations folder */
  migrationsFolder?: string
  /** oRPC contract + implementation; mounted at /api/<apiPrefix|id> */
  contract?: ContractRouter<any>
  router?: (kernel: Kernel) => Router<any, RequestContext>
  /**
   * Plain HTTP routes under the same prefix, for the things oRPC cannot carry — an inbound webhook
   * that needs the unparsed body to check a signature. See `ModuleHttpRoute`, which is where the
   * rules for one are written down.
   */
  httpRoutes?: ModuleHttpRoute[]
  /** event subscriptions: event name (or `module.*` wildcard) → handler */
  subscriptions?: Record<string, EventHandler<any>>
  jobs?: JobDef<any>[]
  automations?: {
    triggers?: AutomationTriggerDef[]
    conditions?: AutomationConditionDef[]
    actions?: AutomationActionDef[]
  }
  search?: SearchIndexer[]
  resolvers?: ObjectResolver[]
  /** procedures other modules/services may call via kernel.call('<module>.<name>', input) */
  procedures?: Record<
    string,
    {
      input?: z.ZodTypeAny
      output?: z.ZodTypeAny
      handler: (input: any, ctx: { kernel: Kernel; principal: Principal }) => Promise<any>
    }
  >
  /** lifecycle */
  onBoot?: (kernel: Kernel) => Promise<void> | void
  onWorkspaceEnabled?: (workspaceId: string, kernel: Kernel) => Promise<void> | void
  onWorkspaceDisabled?: (workspaceId: string, kernel: Kernel) => Promise<void> | void
  onShutdown?: (kernel: Kernel) => Promise<void> | void
}

export function defineModule<TSettings extends z.ZodTypeAny = z.ZodTypeAny>(
  def: ModuleDefinition<TSettings>,
): ModuleDefinition<TSettings> {
  if (!/^[a-z][a-z0-9_]*$/.test(def.id)) throw new Error(`Invalid module id: ${def.id}`)
  return def
}
export function defineServerModule<TSettings extends z.ZodTypeAny = z.ZodTypeAny>(
  mod: ServerModule<TSettings>,
): ServerModule<TSettings> {
  return mod
}

/**
 * The version of the package a module lives in, read from its own `package.json`.
 *
 * A module used to repeat its version as a string literal in `defineModule`, which nobody bumped
 * when changesets released the package — so every shipped module reported a version that was months
 * out of date, in the admin UI and in `installed_version`. Pass `import.meta.url` and the number
 * stays true by construction:
 *
 * ```ts
 * defineModule({ id: 'chat', version: packageVersion(import.meta.url), ... })
 * ```
 */
export function packageVersion(importMetaUrl: string): string {
  let dir = dirname(fileURLToPath(importMetaUrl))
  for (let up = 0; up < 10; up++) {
    const candidate = join(dir, 'package.json')
    if (existsSync(candidate)) {
      const pkg = JSON.parse(readFileSync(candidate, 'utf8')) as { version?: string }
      if (pkg.version) return pkg.version
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`No package.json with a version above ${importMetaUrl}`)
}

export function toManifest(def: ModuleDefinition): ModuleManifest {
  return {
    id: def.id,
    name: def.name,
    version: def.version,
    description: def.description,
    icon: def.icon,
    core: def.core ?? false,
    dependsOn: def.dependsOn ?? [],
    minKernel: def.minKernel,
    permissions: (def.permissions ?? []).map((p) => ({
      ...p,
      scope: p.scope ?? 'workspace',
      defaultRoles: p.defaultRoles ?? [],
      dangerous: p.dangerous ?? false,
    })),
    capabilities: [...(def.capabilities ?? [])],
    events: Object.values(def.events ?? {}).map((e) => e.name),
    objectTypes: (def.objectTypes ?? []).map((o) => ({ ...o, channelable: o.channelable ?? false })),
    settingsSchema: def.settings ? (z_toJSONSchema(def.settings) as Record<string, unknown>) : undefined,
    defaultHost: def.defaultHost ?? 'core',
    apiPrefix: def.apiPrefix,
  }
}

// zod v4 ships JSON schema conversion
import { toJSONSchema as z_toJSONSchema } from 'zod'

/**
 * Version the kernel reports when it was not built as a release (local development, tests). A
 * module's `minKernel` cannot be judged against it, so the check is skipped rather than failing
 * every developer's boot.
 */
export const DEV_VERSION = '0.0.0-dev'

/**
 * Refuse to start when a module declares a platform it cannot get. Kern releases every service and
 * module together, so this only fires on a custom build that mixed versions — which is exactly the
 * case where the failure would otherwise appear much later and look like something else.
 */
export function assertModulesSatisfyKernel(modules: ServerModule[], kernelVersion: string): void {
  if (kernelVersion === DEV_VERSION) return
  const bad = modules
    .filter((m) => m.definition.minKernel)
    .filter(
      (m) => !semverSatisfies(kernelVersion, m.definition.minKernel as string, { includePrerelease: true }),
    )
    .map((m) => `${m.definition.id} requires Kern ${m.definition.minKernel}`)
  if (bad.length)
    throw new Error(
      `This build of Kern is ${kernelVersion}, which does not satisfy every module it contains:\n` +
        bad.map((b) => `  - ${b}`).join('\n') +
        '\nUpgrade Kern, or build these modules against a version they support.',
    )
}
