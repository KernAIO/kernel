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
    /** Told about a cache that failed, so an outage is visible instead of merely survivable. */
    private readonly onCacheError?: (op: 'get' | 'set' | 'del', err: unknown) => void,
  ) {}

  /**
   * Every cache call goes through here, because **a cache being down must not become a refusal**.
   *
   * The reads and writes below were plain `await this.cache?.…`, so an unreachable Valkey threw
   * ioredis' `MaxRetriesPerRequestError` straight out of `effective()` and
   * `core.workspaces.myPermissions` answered **500** — while `/api/health` stayed green, because
   * nothing there touches Valkey. Shell fills `session.permissions` from that one call, so every
   * permission-gated screen in the product rendered empty and the instance looked broken while
   * reporting itself healthy. Losing a cache has to cost latency, never correctness: a failed read
   * is a miss and the answer is computed from Postgres, a failed write is a no-op, and a failed
   * `del` is survivable for the same reason — a cache nobody can reach serves nothing stale either,
   * and the entries expire in 300s regardless.
   *
   * Note it deliberately does not narrow to connection errors. Any throw from a cache is a cache
   * that is not working, and a permission check is the last place to be clever about which.
   */
  private async viaCache<T>(op: 'get' | 'set' | 'del', fn: (c: AuthzCache) => Promise<T>, miss: T) {
    if (!this.cache) return miss
    try {
      return await fn(this.cache)
    } catch (err) {
      this.onCacheError?.(op, err)
      return miss
    }
  }

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

  /**
   * A guest holds nothing that belongs to a project, a space or an object until something gives it
   * to them — applied here, by the process that owns the permission keys.
   *
   * It lived only in core's `bindingsFor`, which enumerates `allPermissions()` of the process that
   * answers, and that process is always core. So the floor listed core's keys and the keys of the
   * five modules core hosts, and nothing else: `module-chat` runs in `chat`, `module-mail` in
   * `mail`, and neither service's guest was restrained by a single key. `chat.message.post` is
   * `scope: 'object'` with `guest` in its `defaultRoles`, so a guest could post in every channel in
   * the workspace while core reported the floor as applied. Measured 2026-09-06 by asking each
   * service's own `Authz` what a guest's effective set contains.
   *
   * Doing it here fixes that by construction rather than by a list: `this.defs` is exactly the
   * modules this process registered, so the floor covers what this process can be asked about and
   * nothing it cannot answer for.
   *
   * Applied before the custom roles and the stored bindings on purpose. "Explicitly given" includes
   * a role, so an administrator's grant is added after the floor and survives it, and a stored
   * workspace-scoped allow is applied after both and wins — the same order core's synthetic binding
   * relied on.
   */
  private applyGuestFloor(set: Set<string>) {
    for (const d of this.defs.values())
      if (d.scope !== 'workspace' && d.scope !== 'instance') set.delete(d.key)
  }

  /** Effective workspace-level permission set (builtin role defaults ∪ custom roles ∪ workspace-scope bindings). */
  async effective(principal: Principal, workspaceId: string): Promise<Set<string>> {
    if (principal.instanceAdmin) return new Set(this.defs.keys())
    const m = this.membership(principal, workspaceId)
    if (!m) return new Set()
    const cacheKey = `authz:${workspaceId}:${principal.userId}:${principal.permissionVersion}`
    const cached = await this.viaCache('get', (c) => c.get(cacheKey), null)
    if (cached) return new Set(JSON.parse(cached) as string[])
    const set = new Set(this.builtinDefaults[m.role])
    if (m.role === 'guest') this.applyGuestFloor(set)
    if (this.store) {
      for (const k of await this.store.customRolePermissions(workspaceId, principal.userId!)) set.add(k)
      for (const b of await this.store.bindings(workspaceId, principal.userId!, m.groupIds, m.role)) {
        if (b.scopeKind !== 'workspace') continue
        for (const k of b.permissions) b.deny ? set.delete(k) : set.add(k)
      }
    }
    await this.viaCache('set', (c) => c.set(cacheKey, JSON.stringify([...set]), 300), undefined)
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
    const prefix = userId ? `authz:${workspaceId}:${userId}:` : `authz:${workspaceId}:`
    await this.viaCache('del', (c) => c.del(prefix), undefined)
  }
}
