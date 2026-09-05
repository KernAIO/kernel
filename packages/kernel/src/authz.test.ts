import type { BuiltinRole, PermissionDef, Principal } from '@kernhq/contracts'
import { describe, expect, it } from 'vitest'
import { Authz, type AuthzCache, type AuthzStore } from './authz.js'

/**
 * A cache being down must cost latency, never correctness.
 *
 * `effective()` awaited the cache directly, so an unreachable Valkey threw ioredis'
 * `MaxRetriesPerRequestError` out through `can()` and `core.workspaces.myPermissions` answered 500
 * — while `/api/health` stayed green, because nothing there touches Valkey. Shell fills
 * `session.permissions` from that one call, so every permission-gated screen rendered empty and the
 * instance looked broken while reporting itself healthy.
 */

const DEFS: Array<PermissionDef & { module: string }> = [
  {
    module: 'core',
    key: 'core.workspace.view',
    label: 'View',
    scope: 'workspace',
    dangerous: false,
    defaultRoles: ['guest'],
  },
  {
    module: 'core',
    key: 'core.members.invite',
    label: 'Invite',
    scope: 'workspace',
    dangerous: false,
    defaultRoles: ['admin'],
  },
]

const principal = (role: BuiltinRole): Principal =>
  ({
    kind: 'user',
    userId: 'u1',
    permissionVersion: 1,
    instanceAdmin: false,
    memberships: [{ workspaceId: 'w1', role, roleIds: [], groupIds: [], status: 'active' }],
  }) as unknown as Principal

const store: AuthzStore = {
  customRolePermissions: async () => ['core.custom.thing'],
  bindings: async () => [],
}

/** Every operation throws, the way ioredis does when it cannot reach the server. */
const brokenCache = (): AuthzCache => ({
  get: async () => {
    throw new Error('Reached the max retries per request limit')
  },
  set: async () => {
    throw new Error('Reached the max retries per request limit')
  },
  del: async () => {
    throw new Error('Reached the max retries per request limit')
  },
})

function authz(cache: AuthzCache, onErr?: (op: string, err: unknown) => void) {
  const a = new Authz(store, cache, onErr as never)
  a.registerPermissions(DEFS)
  return a
}

describe('an unreachable cache', () => {
  it('still answers the permission set, computed from the store', async () => {
    const a = authz(brokenCache())
    const set = await a.effective(principal('admin'), 'w1')
    expect([...set].sort()).toEqual(['core.custom.thing', 'core.members.invite', 'core.workspace.view'])
  })

  it('still decides a permission check rather than throwing', async () => {
    const a = authz(brokenCache())
    await expect(
      a.can(principal('admin'), 'core.members.invite', { kind: 'workspace', workspaceId: 'w1' }),
    ).resolves.toBe(true)
    await expect(
      a.can(principal('guest'), 'core.members.invite', { kind: 'workspace', workspaceId: 'w1' }),
    ).resolves.toBe(false)
  })

  it('does not turn an invalidation into a failed permission change', async () => {
    await expect(authz(brokenCache()).invalidate('w1', 'u1')).resolves.toBeUndefined()
  })

  it('reports the failure, so an outage is visible rather than merely survived', async () => {
    const seen: string[] = []
    const a = authz(brokenCache(), (op) => seen.push(op))
    await a.effective(principal('member'), 'w1')
    // a failed read is a miss, then the recomputed answer is written back and that fails too
    expect(seen).toEqual(['get', 'set'])
  })
})

describe('a working cache', () => {
  it('is still used, and a hit skips the store', async () => {
    const entries = new Map<string, string>()
    const cache: AuthzCache = {
      get: async (k) => entries.get(k) ?? null,
      set: async (k, v) => void entries.set(k, v),
      del: async () => {},
    }
    let storeReads = 0
    const a = new Authz(
      {
        customRolePermissions: async () => {
          storeReads++
          return []
        },
        bindings: async () => [],
      },
      cache,
    )
    a.registerPermissions(DEFS)
    await a.effective(principal('admin'), 'w1')
    await a.effective(principal('admin'), 'w1')
    expect(storeReads).toBe(1)
    expect(entries.size).toBe(1)
  })
})
