import type { core, EventDef, ModuleManifest, PermissionDef, Principal } from '@kernalo/contracts'
import type { ContractRouter } from '@orpc/contract'
import type { Router } from '@orpc/server'
import type { PgSchema } from 'drizzle-orm/pg-core'
import type { z } from 'zod'
import type { RequestContext } from './http.js'
import type { Kernel } from './kernel.js'

/** Handler for a subscribed event. Runs in the hosting service; errors are logged and retried by the bus when durable. */
export type EventHandler<P = unknown> = (
  event: import('@kernalo/contracts').EventEnvelope<P>,
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

export function toManifest(def: ModuleDefinition): ModuleManifest {
  return {
    id: def.id,
    name: def.name,
    version: def.version,
    description: def.description,
    icon: def.icon,
    core: def.core ?? false,
    dependsOn: def.dependsOn ?? [],
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
