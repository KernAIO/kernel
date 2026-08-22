import type { BuiltinRole, PermissionDef, PermissionScope, Principal } from '@kernhq/contracts'
import { KernError } from './errors.js'

export interface Binding {
  subjectType: 'user' | 'group' | 'builtin_role'
  subjectId: string
  permissions: string[]
  scopeKind: 'workspace' | 'project' | 'space' | 'object'
  scopeId: string
  deny: boolean
}
/** Data the engine needs; core implements it over Postgres, other services via kernel.call + cache. */
export interface AuthzStore {
  /** permissions of custom roles assigned to this member (already expanded to keys) */
  customRolePermissions(workspaceId: string, userId: string): Promise<string[]>
  /** bindings relevant to this user (direct, via groups, via builtin role) in a workspace */
  bindings(workspaceId: string, userId: string, groupIds: string[], role: BuiltinRole): Promise<Binding[]>
}
export interface AuthzCache {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSec: number): Promise<void>
  del(prefix: string): Promise<void>
}

const ROLE_RANK: Record<BuiltinRole, number> = { guest: 0, member: 1, admin: 2, owner: 3 }

export class Authz {
  private readonly defs = new Map<string, PermissionDef & { module: string }>()
  private readonly builtinDefaults: Record<BuiltinRole, Set<string>> = {
    owner: new Set(),
    admin: new Set(),
    member: new Set(),
    guest: new Set(),
  }
  constructor(
    private readonly store: AuthzStore | null,
    private readonly cache?: AuthzCache,
  ) {}

  registerPermissions(defs: Array<PermissionDef & { module: string }>) {
    for (const d of defs) {
      this.defs.set(d.key, d)
      for (const r of d.defaultRoles ?? []) this.builtinDefaults[r].add(d.key)
    }
    // owner ⊇ admin ⊇ member ⊇ guest by default
    for (const k of this.builtinDefaults.guest) this.builtinDefaults.member.add(k)
    for (const k of this.builtinDefaults.member) this.builtinDefaults.admin.add(k)
    for (const k of this.builtinDefaults.admin) this.builtinDefaults.owner.add(k)
  }
  allPermissions() {
    return [...this.defs.values()]
  }
  isKnown(key: string) {
    return this.defs.has(key)
  }
  defaultsFor(role: BuiltinRole) {
    return [...this.builtinDefaults[role]]
  }

  membership(principal: Principal, workspaceId: string) {
    return principal.memberships.find((m) => m.workspaceId === workspaceId && m.status === 'active')
  }

  /** Effective workspace-level permission set (builtin role defaults ∪ custom roles ∪ workspace-scope bindings). */
  async effective(principal: Principal, workspaceId: string): Promise<Set<string>> {
    if (principal.instanceAdmin) return new Set(this.defs.keys())
    const m = this.membership(principal, workspaceId)
    if (!m) return new Set()
    const cacheKey = `authz:${workspaceId}:${principal.userId}:${principal.permissionVersion}`
    const cached = await this.cache?.get(cacheKey)
    if (cached) return new Set(JSON.parse(cached) as string[])
    const set = new Set(this.builtinDefaults[m.role])
    if (this.store) {
      for (const k of await this.store.customRolePermissions(workspaceId, principal.userId!)) set.add(k)
      for (const b of await this.store.bindings(workspaceId, principal.userId!, m.groupIds, m.role)) {
        if (b.scopeKind !== 'workspace') continue
        for (const k of b.permissions) b.deny ? set.delete(k) : set.add(k)
      }
    }
    await this.cache?.set(cacheKey, JSON.stringify([...set]), 300)
    return set
  }

  /**
   * Check a permission at a scope. Object/project/space bindings override workspace-level results:
   * nearest scope wins; explicit deny beats allow at the same level; owners/instance admins always pass.
   */
  async can(
    principal: Principal,
    permission: string,
    scope: PermissionScope & { workspaceId: string },
  ): Promise<boolean> {
    if (principal.instanceAdmin) return true
    const m = this.membership(principal, scope.workspaceId)
    if (!m) return false
    if (m.role === 'owner') return true
    if (this.store && scope.kind !== 'workspace') {
      const chain = [{ kind: scope.kind, id: scope.id ?? '' }, ...(scope.parents ?? [])].filter(
        (s) => s.kind !== 'workspace',
      )
      const bindings = await this.store.bindings(scope.workspaceId, principal.userId!, m.groupIds, m.role)
      for (const s of chain) {
        const here = bindings.filter(
          (b) => b.scopeKind === s.kind && b.scopeId === s.id && b.permissions.includes(permission),
        )
        if (here.length) return !here.some((b) => b.deny)
      }
    }
    return (await this.effective(principal, scope.workspaceId)).has(permission)
  }
  async require(principal: Principal, permission: string, scope: PermissionScope & { workspaceId: string }) {
    if (!(await this.can(principal, permission, scope))) throw KernError.forbidden(permission)
  }
  requireMember(principal: Principal, workspaceId: string, minRole: BuiltinRole = 'guest') {
    const m = this.membership(principal, workspaceId)
    if (!m || ROLE_RANK[m.role] < ROLE_RANK[minRole]) throw KernError.forbidden()
    return m
  }
  async invalidate(workspaceId: string, userId?: string) {
    await this.cache?.del(userId ? `authz:${workspaceId}:${userId}:` : `authz:${workspaceId}:`)
  }
}
