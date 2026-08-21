import { z } from 'zod'
import { Timestamp } from '../common.js'
import { Id, ModuleId, ObjectRef, UserId, WorkspaceId } from '../ids.js'

/** Append-only activity record (history, feeds, automation, webhooks). */
export const ActivityEvent = z.object({
  id: Id,
  workspaceId: WorkspaceId,
  module: ModuleId,
  object: ObjectRef,
  /** e.g. `created`, `updated`, `status_changed`, `commented` */
  action: z.string(),
  actorId: UserId.nullable(),
  /** field-level diffs for `updated` */
  changes: z.array(z.object({ field: z.string(), from: z.unknown(), to: z.unknown() })).default([]),
  data: z.record(z.string(), z.unknown()).default({}),
  occurredAt: Timestamp,
})
export type ActivityEvent = z.infer<typeof ActivityEvent>
export const RecordActivity = ActivityEvent.omit({ id: true, occurredAt: true })
