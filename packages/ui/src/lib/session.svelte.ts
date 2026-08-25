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
  /**
   * Capabilities on in the workspace being looked at, namespaced `<moduleId>.<capabilityId>`.
   *
   * Namespaced here because the shell holds every module's at once; a module declares
   * `capability: 'attendance'` against itself, since from inside a module there is only one
   * namespace. Use `hasCapability()` rather than reading this directly and building the key by hand.
   *
   * This is the set the **server** resolved — defaults applied, `required` forced on, anything whose
   * dependency is off pruned. Deriving it again from raw settings would be a second implementation
   * of that closure, and two implementations eventually disagree; the way that shows up is a menu
   * item whose API answers 404.
   */
  capabilities = $state<Set<string>>(new Set())
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

  setCapabilities(capabilities: Iterable<string>) {
    this.capabilities = new Set(capabilities)
  }

  /**
   * Whether this workspace has one of a module's sub-features on.
   *
   * A module asks about its own (`session.hasCapability('hr', 'attendance')`). Answering `true` for
   * a module that declares no capabilities at all is deliberate: most modules are all-or-nothing,
   * and a screen should not have to know whether its module opted into the switchboard.
   */
  hasCapability(moduleId: string, capability?: string) {
    if (!capability) return true
    return this.capabilities.has(`${moduleId}.${capability}`)
  }

  clear() {
    this.user = null
    this.workspaces = []
    this.permissions = new Set()
    this.capabilities = new Set()
    this.ready = true
  }
}

export const session = new SessionState()
