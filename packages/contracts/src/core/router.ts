import { oc } from '@orpc/contract'
import { z } from 'zod'
import { ApiError, PageInput, page } from '../common.js'
import { Id, UserId, WorkspaceId } from '../ids.js'
import { ModuleManifest, WorkspaceModuleState } from '../module.js'
import { ActivityEvent } from './activity.js'
import {
  DashboardItems,
  DashboardLayout,
  DashboardPolicy,
  DashboardSettings,
  DashboardSurface,
  DashboardView,
  PresetId,
} from './dashboard.js'
import { CreateUpload, FileObject, UploadTicket } from './files.js'
import { Notification, NotificationSettings, NotificationTypeDef, PushSubscription } from './notifications.js'
import { SearchHit, SearchInput } from './search.js'
import { InstanceSettings } from './settings.js'
import { UpdatePlan, UpdatePolicy, UpdateStatus } from './updates.js'
import { UpdateMe, User, UserPublic } from './users.js'
import {
  CreateInvitations,
  CreateWorkspace,
  Group,
  Invitation,
  Member,
  Role,
  RoleBinding,
  UpdateMember,
  UpdateWorkspace,
  UpsertGroup,
  UpsertRole,
  Workspace,
  WorkspaceSummary,
} from './workspaces.js'

/** Common error vocabulary every procedure may throw. */
export const base = oc.errors({
  BAD_REQUEST: { data: ApiError.shape.details.optional() },
  UNAUTHORIZED: {},
  FORBIDDEN: { data: z.object({ permission: z.string().optional() }).optional() },
  NOT_FOUND: {},
  CONFLICT: { data: z.object({ reason: z.string().optional() }).optional() },
  RATE_LIMITED: {},
  MODULE_DISABLED: { data: z.object({ module: z.string() }) },
})

const ws = z.object({ workspaceId: WorkspaceId })

export const coreContract = {
  health: oc.route({ method: 'GET', path: '/health', tags: ['system'] }).output(
    z.object({
      ok: z.boolean(),
      service: z.string(),
      /** the release (`KERN_VERSION`) this process was built as */
      version: z.string(),
      modules: z.array(z.object({ id: z.string(), version: z.string() })),
    }),
  ),

  users: {
    me: base
      .route({ method: 'GET', path: '/users/me', tags: ['users'] })
      .output(z.object({ user: User, workspaces: z.array(WorkspaceSummary), permissionVersion: z.number() })),
    updateMe: base
      .route({ method: 'PATCH', path: '/users/me', tags: ['users'] })
      .input(UpdateMe)
      .output(User),
    get: base
      .route({ method: 'GET', path: '/users/{id}', tags: ['users'] })
      .input(z.object({ id: UserId }))
      .output(UserPublic),
    /** users the caller may invite/mention: members of workspaces they share */
    directory: base
      .route({ method: 'GET', path: '/users/directory', tags: ['users'] })
      .input(
        z
          .object({ q: z.string().max(100).optional(), excludeWorkspaceId: WorkspaceId.optional() })
          .extend(PageInput.shape),
      )
      .output(page(UserPublic.extend({ sharedWorkspaces: z.array(z.string()) }))),
  },

  workspaces: {
    list: base
      .route({ method: 'GET', path: '/workspaces', tags: ['workspaces'] })
      .output(z.array(WorkspaceSummary)),
    create: base
      .route({ method: 'POST', path: '/workspaces', tags: ['workspaces'] })
      .input(CreateWorkspace)
      .output(Workspace),
    get: base
      .route({ method: 'GET', path: '/workspaces/{workspaceId}', tags: ['workspaces'] })
      .input(ws)
      .output(Workspace),
    update: base
      .route({ method: 'PATCH', path: '/workspaces/{workspaceId}', tags: ['workspaces'] })
      .input(ws.extend({ patch: UpdateWorkspace }))
      .output(Workspace),
    archive: base
      .route({ method: 'POST', path: '/workspaces/{workspaceId}/archive', tags: ['workspaces'] })
      .input(ws)
      .output(Workspace),
    /** effective permission keys of the caller in this workspace (for UI gating) */
    myPermissions: base
      .route({ method: 'GET', path: '/workspaces/{workspaceId}/me/permissions', tags: ['workspaces'] })
      .input(ws)
      .output(z.object({ role: z.string(), permissions: z.array(z.string()), version: z.number() })),

    members: {
      list: base
        .route({ method: 'GET', path: '/workspaces/{workspaceId}/members', tags: ['members'] })
        .input(ws.extend({ q: z.string().optional(), status: z.string().optional() }).extend(PageInput.shape))
        .output(page(Member)),
      update: base
        .route({ method: 'PATCH', path: '/workspaces/{workspaceId}/members/{userId}', tags: ['members'] })
        .input(ws.extend({ userId: UserId, patch: UpdateMember }))
        .output(Member),
      remove: base
        .route({ method: 'DELETE', path: '/workspaces/{workspaceId}/members/{userId}', tags: ['members'] })
        .input(ws.extend({ userId: UserId }))
        .output(z.object({ ok: z.literal(true) })),
      leave: base
        .route({ method: 'POST', path: '/workspaces/{workspaceId}/members/leave', tags: ['members'] })
        .input(ws)
        .output(z.object({ ok: z.literal(true) })),
    },
    invitations: {
      list: base
        .route({ method: 'GET', path: '/workspaces/{workspaceId}/invitations', tags: ['members'] })
        .input(ws)
        .output(z.array(Invitation)),
      create: base
        .route({ method: 'POST', path: '/workspaces/{workspaceId}/invitations', tags: ['members'] })
        .input(ws.extend(CreateInvitations.shape))
        .output(z.array(Invitation)),
      revoke: base
        .route({ method: 'DELETE', path: '/workspaces/{workspaceId}/invitations/{id}', tags: ['members'] })
        .input(ws.extend({ id: Id }))
        .output(z.object({ ok: z.literal(true) })),
      /** public: preview + accept by token */
      preview: oc
        .route({ method: 'GET', path: '/invitations/{token}', tags: ['members'] })
        .input(z.object({ token: z.string() }))
        .output(
          z.object({
            workspace: Workspace.pick({ id: true, name: true, slug: true, logoUrl: true }),
            email: z.string(),
            inviter: z.string(),
            expired: z.boolean(),
          }),
        ),
      accept: base
        .route({ method: 'POST', path: '/invitations/{token}/accept', tags: ['members'] })
        .input(z.object({ token: z.string() }))
        .output(Workspace),
    },
    roles: {
      list: base
        .route({ method: 'GET', path: '/workspaces/{workspaceId}/roles', tags: ['permissions'] })
        .input(ws)
        .output(z.array(Role)),
      create: base
        .route({ method: 'POST', path: '/workspaces/{workspaceId}/roles', tags: ['permissions'] })
        .input(ws.extend(UpsertRole.shape))
        .output(Role),
      update: base
        .route({ method: 'PATCH', path: '/workspaces/{workspaceId}/roles/{id}', tags: ['permissions'] })
        .input(ws.extend({ id: Id, patch: UpsertRole.partial() }))
        .output(Role),
      delete: base
        .route({ method: 'DELETE', path: '/workspaces/{workspaceId}/roles/{id}', tags: ['permissions'] })
        .input(ws.extend({ id: Id }))
        .output(z.object({ ok: z.literal(true) })),
      /** registry of all permission keys known to this instance */
      permissions: base.route({ method: 'GET', path: '/permissions', tags: ['permissions'] }).output(
        z.array(
          z.object({
            key: z.string(),
            label: z.string(),
            description: z.string().optional(),
            module: z.string(),
            scope: z.string(),
            dangerous: z.boolean(),
          }),
        ),
      ),
      bindings: {
        list: base
          .route({ method: 'GET', path: '/workspaces/{workspaceId}/bindings', tags: ['permissions'] })
          .input(ws.extend({ scopeKind: z.string().optional(), scopeId: z.string().optional() }))
          .output(z.array(RoleBinding)),
        set: base
          .route({ method: 'PUT', path: '/workspaces/{workspaceId}/bindings', tags: ['permissions'] })
          .input(ws.extend({ binding: RoleBinding.omit({ id: true, workspaceId: true }) }))
          .output(RoleBinding),
        delete: base
          .route({ method: 'DELETE', path: '/workspaces/{workspaceId}/bindings/{id}', tags: ['permissions'] })
          .input(ws.extend({ id: Id }))
          .output(z.object({ ok: z.literal(true) })),
      },
    },
    groups: {
      list: base
        .route({ method: 'GET', path: '/workspaces/{workspaceId}/groups', tags: ['groups'] })
        .input(ws)
        .output(z.array(Group)),
      create: base
        .route({ method: 'POST', path: '/workspaces/{workspaceId}/groups', tags: ['groups'] })
        .input(ws.extend(UpsertGroup.shape))
        .output(Group),
      update: base
        .route({ method: 'PATCH', path: '/workspaces/{workspaceId}/groups/{id}', tags: ['groups'] })
        .input(ws.extend({ id: Id, patch: UpsertGroup.partial() }))
        .output(Group),
      delete: base
        .route({ method: 'DELETE', path: '/workspaces/{workspaceId}/groups/{id}', tags: ['groups'] })
        .input(ws.extend({ id: Id }))
        .output(z.object({ ok: z.literal(true) })),
      setMembers: base
        .route({ method: 'PUT', path: '/workspaces/{workspaceId}/groups/{id}/members', tags: ['groups'] })
        .input(ws.extend({ id: Id, userIds: z.array(UserId) }))
        .output(Group),
      members: base
        .route({ method: 'GET', path: '/workspaces/{workspaceId}/groups/{id}/members', tags: ['groups'] })
        .input(ws.extend({ id: Id }))
        .output(z.array(UserPublic)),
    },
    modules: {
      list: base
        .route({ method: 'GET', path: '/workspaces/{workspaceId}/modules', tags: ['modules'] })
        .input(ws)
        .output(z.array(z.object({ manifest: ModuleManifest, state: WorkspaceModuleState }))),
      setEnabled: base
        .route({
          method: 'PUT',
          path: '/workspaces/{workspaceId}/modules/{moduleId}/enabled',
          tags: ['modules'],
        })
        .input(ws.extend({ moduleId: z.string(), enabled: z.boolean() }))
        .output(WorkspaceModuleState),
      updateSettings: base
        .route({
          method: 'PATCH',
          path: '/workspaces/{workspaceId}/modules/{moduleId}/settings',
          tags: ['modules'],
        })
        .input(ws.extend({ moduleId: z.string(), settings: z.record(z.string(), z.unknown()) }))
        .output(WorkspaceModuleState),
    },
    audit: base
      .route({ method: 'GET', path: '/workspaces/{workspaceId}/audit', tags: ['workspaces'] })
      .input(ws.extend({ module: z.string().optional(), actorId: UserId.optional() }).extend(PageInput.shape))
      .output(page(ActivityEvent)),
  },

  /**
   * The workspace dashboard.
   *
   * `get`, `save` and `reset` carry no permission key: they touch the caller's own row, and every
   * widget drawn inside is gated by the procedure it calls, which is the check that matters. The
   * `settings` group is `core.workspace.manage` — whoever sets the workspace logo sets its home
   * page.
   */
  dashboard: {
    get: base
      .route({ method: 'GET', path: '/workspaces/{workspaceId}/dashboard', tags: ['dashboard'] })
      .input(ws.extend({ surface: DashboardSurface.default('home') }))
      .output(DashboardView),
    /** Refused with CONFLICT `core.dashboard.locked` when the workspace locked the layout. */
    save: base
      .route({ method: 'PUT', path: '/workspaces/{workspaceId}/dashboard', tags: ['dashboard'] })
      .input(
        ws.extend({
          surface: DashboardSurface.default('home'),
          items: DashboardItems,
          presetId: PresetId.nullable().default(null),
        }),
      )
      .output(DashboardLayout),
    /** Drops the caller's own layout so the workspace's, or the preset, applies again. */
    reset: base
      .route({ method: 'POST', path: '/workspaces/{workspaceId}/dashboard/reset', tags: ['dashboard'] })
      .input(ws.extend({ surface: DashboardSurface.default('home') }))
      .output(DashboardView),

    settings: {
      get: base
        .route({ method: 'GET', path: '/workspaces/{workspaceId}/dashboard/settings', tags: ['dashboard'] })
        .input(ws.extend({ surface: DashboardSurface.default('home') }))
        .output(DashboardSettings),
      set: base
        .route({ method: 'PUT', path: '/workspaces/{workspaceId}/dashboard/settings', tags: ['dashboard'] })
        .input(
          ws.extend({
            surface: DashboardSurface.default('home'),
            policy: DashboardPolicy.optional(),
            defaultPresetId: PresetId.optional(),
          }),
        )
        .output(DashboardSettings),
      /** The layout members start from. Edited on the real page, at its real size. */
      saveWorkspace: base
        .route({ method: 'PUT', path: '/workspaces/{workspaceId}/dashboard/workspace', tags: ['dashboard'] })
        .input(
          ws.extend({
            surface: DashboardSurface.default('home'),
            items: DashboardItems,
            presetId: PresetId.nullable().default(null),
          }),
        )
        .output(DashboardLayout),
    },
  },

  notifications: {
    list: base
      .route({ method: 'GET', path: '/notifications', tags: ['notifications'] })
      .input(
        z
          .object({ workspaceId: WorkspaceId.optional(), unreadOnly: z.boolean().default(false) })
          .extend(PageInput.shape),
      )
      .output(page(Notification)),
    counts: base
      .route({ method: 'GET', path: '/notifications/counts', tags: ['notifications'] })
      .output(
        z.array(z.object({ workspaceId: WorkspaceId.nullable(), unread: z.number(), mentions: z.number() })),
      ),
    markRead: base
      .route({ method: 'POST', path: '/notifications/read', tags: ['notifications'] })
      .input(
        z.object({
          ids: z.array(Id).optional(),
          workspaceId: WorkspaceId.optional(),
          all: z.boolean().default(false),
        }),
      )
      .output(z.object({ updated: z.number() })),
    archive: base
      .route({ method: 'POST', path: '/notifications/{id}/archive', tags: ['notifications'] })
      .input(z.object({ id: Id }))
      .output(Notification),
    types: base
      .route({ method: 'GET', path: '/notifications/types', tags: ['notifications'] })
      .output(z.array(NotificationTypeDef.extend({ module: z.string() }))),
    settings: base
      .route({ method: 'GET', path: '/notifications/settings', tags: ['notifications'] })
      .output(NotificationSettings),
    updateSettings: base
      .route({ method: 'PUT', path: '/notifications/settings', tags: ['notifications'] })
      .input(NotificationSettings)
      .output(NotificationSettings),
    subscribePush: base
      .route({ method: 'POST', path: '/notifications/push/subscribe', tags: ['notifications'] })
      .input(PushSubscription)
      .output(z.object({ ok: z.literal(true) })),
    unsubscribePush: base
      .route({ method: 'POST', path: '/notifications/push/unsubscribe', tags: ['notifications'] })
      .input(z.object({ endpoint: z.string() }))
      .output(z.object({ ok: z.literal(true) })),
    vapidPublicKey: oc
      .route({ method: 'GET', path: '/notifications/push/vapid', tags: ['notifications'] })
      .output(z.object({ publicKey: z.string().nullable() })),
  },

  files: {
    createUpload: base
      .route({ method: 'POST', path: '/files/uploads', tags: ['files'] })
      .input(CreateUpload)
      .output(UploadTicket),
    complete: base
      .route({ method: 'POST', path: '/files/{id}/complete', tags: ['files'] })
      .input(z.object({ id: Id }))
      .output(FileObject),
    get: base
      .route({ method: 'GET', path: '/files/{id}', tags: ['files'] })
      .input(z.object({ id: Id }))
      .output(FileObject),
    downloadUrl: base
      .route({ method: 'GET', path: '/files/{id}/url', tags: ['files'] })
      .input(
        z.object({
          id: Id,
          disposition: z.enum(['inline', 'attachment']).default('inline'),
          thumbnail: z.boolean().default(false),
        }),
      )
      .output(z.object({ url: z.string().url(), expiresAt: z.string() })),
    delete: base
      .route({ method: 'DELETE', path: '/files/{id}', tags: ['files'] })
      .input(z.object({ id: Id }))
      .output(z.object({ ok: z.literal(true) })),
  },

  search: base
    .route({ method: 'GET', path: '/search', tags: ['search'] })
    .input(SearchInput)
    .output(z.object({ hits: z.array(SearchHit), tookMs: z.number() })),

  admin: {
    settings: base
      .route({ method: 'GET', path: '/admin/settings', tags: ['admin'] })
      .output(InstanceSettings),
    updateSettings: base
      .route({ method: 'PUT', path: '/admin/settings', tags: ['admin'] })
      .input(InstanceSettings.partial())
      .output(InstanceSettings),
    users: base
      .route({ method: 'GET', path: '/admin/users', tags: ['admin'] })
      .input(z.object({ q: z.string().optional() }).extend(PageInput.shape))
      .output(page(User)),
    setUserStatus: base
      .route({ method: 'POST', path: '/admin/users/{id}/status', tags: ['admin'] })
      .input(
        z.object({
          id: UserId,
          status: z.enum(['active', 'suspended']),
          instanceAdmin: z.boolean().optional(),
        }),
      )
      .output(User),
    workspaces: base
      .route({ method: 'GET', path: '/admin/workspaces', tags: ['admin'] })
      .input(PageInput)
      .output(page(Workspace.extend({ memberCount: z.number() }))),
    modules: base
      .route({ method: 'GET', path: '/admin/modules', tags: ['admin'] })
      .output(z.array(ModuleManifest.extend({ host: z.string(), healthy: z.boolean() }))),

    /** Platform updates: what this instance runs, what the newest stable release is, how to take it. */
    updates: {
      get: base.route({ method: 'GET', path: '/admin/updates', tags: ['admin'] }).output(UpdateStatus),
      /** Re-read the release feed now instead of waiting for the scheduled check. */
      check: base
        .route({ method: 'POST', path: '/admin/updates/check', tags: ['admin'] })
        .output(UpdateStatus),
      setPolicy: base
        .route({ method: 'PUT', path: '/admin/updates/policy', tags: ['admin'] })
        .input(UpdatePolicy.partial())
        .output(UpdateStatus),
      /** What an automatic upgrade would do right now. The host's timer asks this before it acts. */
      plan: base.route({ method: 'GET', path: '/admin/updates/plan', tags: ['admin'] }).output(UpdatePlan),
    },
  },
}
export type CoreContract = typeof coreContract
