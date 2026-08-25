import { QueryClient } from '@tanstack/svelte-query'

/**
 * Query keys and the shared client defaults.
 *
 * Keys are structured `[module, entity, …scope]` so a realtime `change` message can invalidate
 * exactly the queries an event touched: the matcher compares the `[module, entity]` prefix
 * element-wise, so anything scoped below it is invalidated with its parent.
 *
 * Only **core**'s keys are listed here. A module names its own the same way —
 * `['tracker', 'issue', projectId]` — and gets the same invalidation for free; it does not add
 * them to this object, because a module the instance does not ship must not appear in the
 * framework's key list.
 *
 * This lives in the framework rather than in the app because a module's screens build queries and
 * the shell invalidates them: the two halves have to agree on the shape, and a module cannot
 * import the app to find it out.
 */
export const keys = {
  me: () => ['core', 'me'] as const,
  workspaces: () => ['core', 'workspace'] as const,
  workspace: (id: string) => ['core', 'workspace', id] as const,
  permissions: (id: string) => ['core', 'permissions', id] as const,
  members: (id: string) => ['core', 'member', id] as const,
  invitations: (id: string) => ['core', 'invitation', id] as const,
  roles: (id: string) => ['core', 'role', id] as const,
  permissionRegistry: () => ['core', 'permission-registry'] as const,
  groups: (id: string) => ['core', 'group', id] as const,
  modules: (id: string) => ['core', 'module', id] as const,
  audit: (id: string) => ['core', 'audit', id] as const,
  // One entity for both, so a realtime `change` on the dashboard invalidates the layout and the
  // settings together. `['core','dashboard-settings',…]` would not match: realtime.svelte.ts
  // compares the [module, entity] prefix element-wise.
  dashboard: (workspaceId: string) => ['core', 'dashboard', workspaceId] as const,
  dashboardSettings: (workspaceId: string) => ['core', 'dashboard', workspaceId, 'settings'] as const,
  notifications: (scope: string) => ['core', 'notification', scope] as const,
  notificationCounts: () => ['core', 'notification-counts'] as const,
  notificationTypes: () => ['core', 'notification-type'] as const,
  notificationSettings: () => ['core', 'notification-settings'] as const,
  search: (workspaceId: string, q: string) => ['core', 'search', workspaceId, q] as const,
  adminUsers: () => ['core', 'admin-user'] as const,
  adminWorkspaces: () => ['core', 'admin-workspace'] as const,
  adminModules: () => ['core', 'admin-module'] as const,
  adminSettings: () => ['core', 'admin-settings'] as const,
  adminUpdates: () => ['core', 'admin-updates'] as const,
  adminDiagnostics: () => ['core', 'admin-diagnostics'] as const,
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // realtime invalidation keeps data fresh, so polling is unnecessary
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const code = (error as { code?: string })?.code
          if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN' || code === 'NOT_FOUND') return false
          return failureCount < 2
        },
      },
      mutations: { retry: 0 },
    },
  })
}
