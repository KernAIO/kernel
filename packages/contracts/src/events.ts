import { z } from 'zod'
import { Id, ModuleId, UserId, WorkspaceId } from './ids.js'
import { Timestamp } from './common.js'

/**
 * Event names are `<module>.<entity>.<action>`, e.g. `tracker.issue.created`.
 * Workspace-scoped events carry `workspaceId`; instance events (user.created) may not.
 */
export const EventName = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,3}$/)
export type EventName = z.infer<typeof EventName>

export const EventEnvelope = z.object({
  id: Id,
  name: EventName,
  version: z.number().int().min(1).default(1),
  module: ModuleId,
  workspaceId: WorkspaceId.nullable(),
  actorId: UserId.nullable(),
  occurredAt: Timestamp,
  /** correlation id for tracing a user action across services */
  traceId: z.string().optional(),
  payload: z.unknown(),
})
export type EventEnvelope<P = unknown> = Omit<z.infer<typeof EventEnvelope>, 'payload'> & { payload: P }

export interface EventDef<TName extends string = string, TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  readonly name: TName
  readonly module: string
  readonly version: number
  readonly schema: TSchema
  readonly description?: string
}
export type EventPayload<E> = E extends EventDef<string, infer S> ? z.infer<S> : never

export function defineEvent<TName extends string, TSchema extends z.ZodTypeAny>(
  name: TName,
  schema: TSchema,
  opts: { version?: number; description?: string } = {},
): EventDef<TName, TSchema> {
  EventName.parse(name)
  return { name, module: name.split('.')[0]!, version: opts.version ?? 1, schema, description: opts.description }
}

/** Generic CRUD change event payload used by the realtime layer for cache invalidation. */
export const EntityChange = z.object({
  module: ModuleId,
  entity: z.string(),
  id: Id,
  op: z.enum(['created', 'updated', 'deleted']),
  /** optional partial patch for optimistic client updates */
  patch: z.record(z.string(), z.unknown()).optional(),
  /** parents to invalidate, e.g. projectId for an issue */
  scope: z.record(z.string(), z.string()).optional(),
})
export type EntityChange = z.infer<typeof EntityChange>
