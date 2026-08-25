import type { core } from '@kernhq/contracts'

/**
 * The signed-in user, their workspaces, and the permissions they hold in the workspace they are
 * looking at.
 *
 * This lives in the framework rather than in the app because a module's own screens have to gate on
 * it: `can()` is what decides whether a row, an action or a settings page is offered at all, and a
 * module cannot import the app. The app fills it once per navigation from its layout; everything
 * else reads it.
 *
 * A singleton on purpose. `@kernhq/ui` is pinned to one copy in every install (`pnpm.overrides`),
 * so one module writing here is the same object another module reads — which is the point. If two
 * copies of this package ever coexist, permissions silently disagree between modules; that is the
 * failure this pin exists to prevent.
 */
class SessionState {
  user = $state<core.User | null>(null)
  workspaces = $state<core.WorkspaceSummary[]>([])
  permissions = $state<Set<string>>(new Set())
  role = $state<string>('member')
  ready = $state(false)

  get signedIn() {
    return this.user !== null
  }

  can(permission: string) {
    return this.user?.instanceAdmin === true || this.role === 'owner' || this.permissions.has(permission)
  }

  setSession(user: core.User | null, workspaces: core.WorkspaceSummary[]) {
    this.user = user
    this.workspaces = workspaces
    this.ready = true
  }

  setPermissions(role: string, permissions: string[]) {
    this.role = role
    this.permissions = new Set(permissions)
  }

  clear() {
    this.user = null
    this.workspaces = []
    this.permissions = new Set()
    this.ready = true
  }
}

export const session = new SessionState()
