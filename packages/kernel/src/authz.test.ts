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

/**
 * The guest deny-floor, in a service that is not core.
 *
 * The floor was written into core's `bindingsFor`, which enumerates `allPermissions()` of the
 * process that answers — always core. `chat` hosts `module-chat` and asks core over the broker, so
 * the binding it received named core's keys and nothing of its own: `chat.message.post` is
 * `scope: 'object'` with `guest` in its `defaultRoles`, and a guest kept it. This is that shape —
 * the store returns exactly what core sends and the defs are the asking process's.
 */
describe('a guest in a service core does not host', () => {
  const CHAT_DEFS: Array<PermissionDef & { module: string }> = [
    {
      module: 'chat',
      key: 'chat.channel.view',
      label: 'View channels',
      scope: 'workspace',
      dangerous: false,
      defaultRoles: ['guest'],
    },
    {
      module: 'chat',
      key: 'chat.message.post',
      label: 'Post messages',
      scope: 'object',
      dangerous: false,
      defaultRoles: ['guest'],
    },
  ]
  /** What `core.authz.bindings` sends: a deny carrying core's non-workspace keys, and no chat key. */
  const fromCore: AuthzStore = {
    customRolePermissions: async () => [],
    bindings: async () => [
      {
        subjectType: 'builtin_role',
        subjectId: 'guest',
        permissions: ['core.audit.view'],
        scopeKind: 'workspace',
        scopeId: 'w1',
        deny: true,
      },
    ],
  }
  const chatAuthz = (store: AuthzStore = fromCore) => {
    const a = new Authz(store)
    a.registerPermissions(CHAT_DEFS)
    return a
  }

  it('holds no object-scoped permission of this process, and keeps the workspace-scoped one', async () => {
    const set = await chatAuthz().effective(principal('guest'), 'w1')
    expect([...set]).toEqual(['chat.channel.view'])
  })

  it('is refused a post it would have been allowed', async () => {
    await expect(
      chatAuthz().can(principal('guest'), 'chat.message.post', {
        kind: 'object',
        id: 'c1',
        workspaceId: 'w1',
        parents: [{ kind: 'workspace', id: 'w1' }],
      }),
    ).resolves.toBe(false)
  })

  it('posts in the one channel it was bound to, and in no other', async () => {
    const bound = chatAuthz({
      customRolePermissions: fromCore.customRolePermissions,
      bindings: async () => [
        ...(await fromCore.bindings('w1', 'u1', [], 'guest')),
        {
          subjectType: 'user',
          subjectId: 'u1',
          permissions: ['chat.message.post'],
          scopeKind: 'object',
          scopeId: 'c1',
          deny: false,
        },
      ],
    })
    const at = (id: string) =>
      bound.can(principal('guest'), 'chat.message.post', {
        kind: 'object',
        id,
        workspaceId: 'w1',
        parents: [{ kind: 'workspace', id: 'w1' }],
      })
    await expect(at('c1')).resolves.toBe(true)
    await expect(at('c2')).resolves.toBe(false)
  })

  it('keeps what a custom role gives it, because the floor is applied before them', async () => {
    const withRole = chatAuthz({
      customRolePermissions: async () => ['chat.message.post'],
      bindings: fromCore.bindings,
    })
    const set = await withRole.effective(principal('guest'), 'w1')
    expect([...set].sort()).toEqual(['chat.channel.view', 'chat.message.post'])
  })

  it('leaves a member alone', async () => {
    const a = new Authz(fromCore)
    a.registerPermissions(
      CHAT_DEFS.map((d) => ({ ...d, defaultRoles: ['member' as const, 'guest' as const] })),
    )
    const set = await a.effective(principal('member'), 'w1')
    expect([...set].sort()).toEqual(['chat.channel.view', 'chat.message.post'])
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
