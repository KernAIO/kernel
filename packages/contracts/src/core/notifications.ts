import { z } from 'zod'
import { Timestamp } from '../common.js'
import { Id, ModuleId, ObjectRef, UserId, WorkspaceId } from '../ids.js'

export const NotificationChannel = z.enum(['inapp', 'push', 'email'])
export type NotificationChannel = z.infer<typeof NotificationChannel>

export const Notification = z.object({
  id: Id,
  userId: UserId,
  workspaceId: WorkspaceId.nullable(),
  module: ModuleId,
  /** e.g. `tracker.issue.assigned`, `chat.mention` */
  type: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  /** where clicking leads */
  object: ObjectRef.nullable(),
  url: z.string().nullable(),
  actor: z.object({ id: UserId, name: z.string(), avatarUrl: z.string().nullable() }).nullable(),
  data: z.record(z.string(), z.unknown()).default({}),
  /** group key for collapsing (e.g. same issue) */
  groupKey: z.string().nullable(),
  readAt: Timestamp.nullable(),
  archivedAt: Timestamp.nullable(),
  createdAt: Timestamp,
})
export type Notification = z.infer<typeof Notification>

/** Module-declared notification type (drives preferences UI + defaults). */
export const NotificationTypeDef = z.object({
  type: z.string(),
  label: z.string(),
  description: z.string().optional(),
  defaults: z.object({ inapp: z.boolean().default(true), push: z.boolean().default(true), email: z.boolean().default(false) }),
  /** mention-like → bypasses mute/digest */
  urgent: z.boolean().default(false),
})
export type NotificationTypeDef = z.infer<typeof NotificationTypeDef>

export const NotificationPreference = z.object({
  type: z.string(),
  workspaceId: WorkspaceId.nullable(),
  inapp: z.boolean(),
  push: z.boolean(),
  email: z.boolean(),
})
export const NotificationSettings = z.object({
  emailDigest: z.enum(['off', 'hourly', 'daily']).default('daily'),
  quietHours: z.object({ start: z.string(), end: z.string(), timezone: z.string() }).nullable().default(null),
  preferences: z.array(NotificationPreference).default([]),
})

export const CreateNotification = Notification.pick({
  userId: true, workspaceId: true, module: true, type: true, title: true, body: true, object: true, url: true, data: true, groupKey: true,
}).extend({ actorId: UserId.nullable().default(null) })
export type CreateNotification = z.infer<typeof CreateNotification>

export const PushSubscription = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
  userAgent: z.string().optional(),
})
