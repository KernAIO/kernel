import { z } from 'zod'
import { Color, Email, Timestamp } from '../common.js'
import { Slug, UserId, WorkspaceId } from '../ids.js'
import { BuiltinRole } from '../permissions.js'

export const WorkspacePlan = z.enum(['self_hosted', 'free', 'team', 'business', 'enterprise'])

export const Workspace = z.object({
  id: WorkspaceId,
  slug: Slug,
  name: z.string().min(1).max(80),
  description: z.string().max(500).nullable(),
  logoUrl: z.string().url().nullable(),
  accentColor: Color.nullable(),
  /** email domains that may auto-join (verified) */
  autoJoinDomains: z.array(z.string()).default([]),
  defaultRole: BuiltinRole.default('member'),
  plan: WorkspacePlan.default('self_hosted'),
  archivedAt: Timestamp.nullable(),
  createdBy: UserId,
  createdAt: Timestamp,
  updatedAt: Timestamp,
})
export type Workspace = z.infer<typeof Workspace>

export const CreateWorkspace = z.object({
  name: z.string().min(1).max(80),
  slug: Slug,
  description: z.string().max(500).optional(),
})
export const UpdateWorkspace = Workspace.pick({
  name: true,
  description: true,
  logoUrl: true,
  accentColor: true,
  autoJoinDomains: true,
  defaultRole: true,
}).partial()

/** A workspace as seen in the user's switcher */
export const WorkspaceSummary = Workspace.pick({
  id: true,
  slug: true,
  name: true,
  logoUrl: true,
  accentColor: true,
}).extend({
  role: BuiltinRole,
  unread: z.number().int().default(0),
  mentions: z.number().int().default(0),
  memberCount: z.number().int().optional(),
})
export type WorkspaceSummary = z.infer<typeof WorkspaceSummary>

// ---------- members ----------
export const MemberStatus = z.enum(['active', 'invited', 'suspended'])
export const Member = z.object({
  id: z.uuid(),
  workspaceId: WorkspaceId,
  userId: UserId,
  role: BuiltinRole,
  roleIds: z.array(z.uuid()).default([]),
  groupIds: z.array(z.uuid()).default([]),
  title: z.string().max(120).nullable(),
  status: MemberStatus,
  joinedAt: Timestamp,
  user: z.object({
    id: UserId,
    name: z.string(),
    email: Email,
    username: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }),
})
export type Member = z.infer<typeof Member>

export const UpdateMember = z.object({
  role: BuiltinRole.optional(),
  roleIds: z.array(z.uuid()).optional(),
  groupIds: z.array(z.uuid()).optional(),
  title: z.string().max(120).nullable().optional(),
  status: MemberStatus.optional(),
})

// ---------- invitations ----------
export const Invitation = z.object({
  id: z.uuid(),
  workspaceId: WorkspaceId,
  email: Email,
  role: BuiltinRole,
  roleIds: z.array(z.uuid()).default([]),
  groupIds: z.array(z.uuid()).default([]),
  /** guests: restrict to these object refs (projects/channels) */
  guestScopes: z.array(z.string()).default([]),
  invitedBy: UserId,
  message: z.string().max(1000).nullable(),
  status: z.enum(['pending', 'accepted', 'revoked', 'expired']),
  expiresAt: Timestamp,
  createdAt: Timestamp,
})
export type Invitation = z.infer<typeof Invitation>

export const CreateInvitations = z.object({
  invites: z
    .array(
      z.object({
        email: Email.optional(),
        /** invite an existing user (from another workspace you share) by id */
        userId: UserId.optional(),
        role: BuiltinRole.default('member'),
        roleIds: z.array(z.uuid()).default([]),
        groupIds: z.array(z.uuid()).default([]),
        guestScopes: z.array(z.string()).default([]),
      }),
    )
    .min(1)
    .max(200),
  message: z.string().max(1000).optional(),
})

// ---------- roles & groups ----------
export const Role = z.object({
  id: z.uuid(),
  workspaceId: WorkspaceId,
  name: z.string().min(1).max(64),
  description: z.string().max(300).nullable(),
  permissions: z.array(z.string()),
  builtin: z.boolean().default(false),
  createdAt: Timestamp,
})
export type Role = z.infer<typeof Role>
export const UpsertRole = Role.pick({ name: true, description: true, permissions: true })

export const Group = z.object({
  id: z.uuid(),
  workspaceId: WorkspaceId,
  name: z.string().min(1).max(64),
  handle: Slug,
  description: z.string().max(300).nullable(),
  memberCount: z.number().int().default(0),
  createdAt: Timestamp,
})
export type Group = z.infer<typeof Group>
export const UpsertGroup = Group.pick({ name: true, handle: true, description: true })

/** A permission binding at a scope (workspace/project/space/object). */
export const RoleBinding = z.object({
  id: z.uuid(),
  workspaceId: WorkspaceId,
  subjectType: z.enum(['user', 'group', 'builtin_role']),
  subjectId: z.string(),
  roleId: z.uuid().nullable(),
  /** direct permission grants instead of a role */
  permissions: z.array(z.string()).default([]),
  scopeKind: z.enum(['workspace', 'project', 'space', 'object']),
  scopeId: z.string(),
  deny: z.boolean().default(false),
})
export type RoleBinding = z.infer<typeof RoleBinding>
