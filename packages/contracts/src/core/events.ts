import { z } from 'zod'
import { defineEvent } from '../events.js'
import { Id, UserId, WorkspaceId } from '../ids.js'
import { BuiltinRole } from '../permissions.js'

export const coreEvents = {
  userCreated: defineEvent('core.user.created', z.object({ userId: UserId, email: z.string() })),
  userUpdated: defineEvent('core.user.updated', z.object({ userId: UserId, fields: z.array(z.string()) })),
  workspaceCreated: defineEvent('core.workspace.created', z.object({ workspaceId: WorkspaceId, slug: z.string(), createdBy: UserId })),
  workspaceUpdated: defineEvent('core.workspace.updated', z.object({ workspaceId: WorkspaceId, fields: z.array(z.string()) })),
  workspaceArchived: defineEvent('core.workspace.archived', z.object({ workspaceId: WorkspaceId })),
  memberJoined: defineEvent('core.member.joined', z.object({ workspaceId: WorkspaceId, userId: UserId, role: BuiltinRole })),
  memberUpdated: defineEvent('core.member.updated', z.object({ workspaceId: WorkspaceId, userId: UserId, role: BuiltinRole })),
  memberRemoved: defineEvent('core.member.removed', z.object({ workspaceId: WorkspaceId, userId: UserId })),
  /** any role/group/binding change → services drop cached permission sets */
  permissionsChanged: defineEvent('core.permissions.changed', z.object({ workspaceId: WorkspaceId, userIds: z.array(UserId).nullable() })),
  moduleEnabled: defineEvent('core.module.enabled', z.object({ workspaceId: WorkspaceId, moduleId: z.string(), enabled: z.boolean() })),
  moduleSettingsUpdated: defineEvent('core.module.settings_updated', z.object({ workspaceId: WorkspaceId, moduleId: z.string() })),
  notificationCreated: defineEvent('core.notification.created', z.object({ notificationId: Id, userId: UserId, workspaceId: WorkspaceId.nullable(), type: z.string(), urgent: z.boolean() })),
  fileReady: defineEvent('core.file.ready', z.object({ fileId: Id, workspaceId: WorkspaceId, mimeType: z.string() })),
} as const
