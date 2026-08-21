import { z } from 'zod'

/** `<module>.<resource>.<action>`, e.g. `tracker.issue.create`, `core.workspace.manage` */
export const PermissionKey = z.string().regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/)
export type PermissionKey = z.infer<typeof PermissionKey>

export const PermissionScopeKind = z.enum(['instance', 'workspace', 'project', 'space', 'object'])
export type PermissionScopeKind = z.infer<typeof PermissionScopeKind>

export const PermissionDef = z.object({
  key: PermissionKey,
  /** i18n string id or English fallback */
  label: z.string(),
  description: z.string().optional(),
  /** narrowest scope at which this permission can be bound */
  scope: PermissionScopeKind.default('workspace'),
  /** granted automatically to these built-in roles */
  defaultRoles: z.array(z.enum(['owner', 'admin', 'member', 'guest'])).default([]),
  dangerous: z.boolean().default(false),
})
export type PermissionDef = z.infer<typeof PermissionDef>

export function definePermissions<const T extends readonly PermissionDef[]>(defs: T): T {
  for (const d of defs) PermissionDef.parse(d)
  return defs
}

/** Built-in workspace roles (custom roles are workspace data). */
export const BuiltinRole = z.enum(['owner', 'admin', 'member', 'guest'])
export type BuiltinRole = z.infer<typeof BuiltinRole>

export const PermissionScope = z.object({
  kind: PermissionScopeKind,
  /** id of the scope object (workspaceId / projectId / spaceId / objectId); undefined for instance */
  id: z.string().optional(),
  /** parent chain for inheritance resolution, nearest first, e.g. [{project},{workspace}] */
  parents: z.array(z.object({ kind: PermissionScopeKind, id: z.string() })).optional(),
})
export type PermissionScope = z.infer<typeof PermissionScope>
