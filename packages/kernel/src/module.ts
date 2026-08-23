import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { core, EventDef, ModuleManifest, PermissionDef, Principal } from '@kernhq/contracts'
import type { ContractRouter } from '@orpc/contract'
import type { Router } from '@orpc/server'
import type { PgSchema } from 'drizzle-orm/pg-core'
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
