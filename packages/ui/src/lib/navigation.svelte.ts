/**
 * Where the shell currently is, and how a module asks it to go somewhere else.
 *
 * A module cannot import `$app/navigation` or `$app/state`: those are SvelteKit aliases, and a
 * module package is compiled and type-checked on its own, where they do not exist. They *appear* to
 * work while the module is being edited inside the app — which is exactly how the dependency gets
 * added without anyone noticing, and why it only fails once the package is built standalone.
 *
 * So the shell fills this on every navigation and modules read it. The same singleton rule as
 * `session`: one copy of `@kernhq/ui` in the tree, pinned by `pnpm.overrides`.
 *
 * A page usually does not need this at all — `ModuleRoute` passes `params` and `workspaceSlug` as
 * props. It is for the parts that sit outside a route: a sidebar that highlights the open page, a
 * presenter rendering inside someone else's screen.
 */

/** Reactive so a component highlighting the current route re-renders when it changes. */
let pathname = $state('/')
let params = $state<Record<string, string>>({})
let search = $state<Record<string, string>>({})
let go: ((href: string) => void) | null = null

export const navigation = {
  get pathname() {
    return pathname
  },
  /** Route parameters the shell matched, including `ws` — the workspace slug. */
  get params() {
    return params
  },
  /** Query string, flattened. Repeated keys keep the first value; nothing here needs the rest. */
  get search() {
    return search
  },
  get workspaceSlug() {
    return params.ws ?? ''
  },
  /**
   * Navigate, through the shell's router rather than a full page load.
   *
   * Falls back to assigning `location.href` when no shell has registered one — a module rendered in
   * isolation (a test, a storybook) should still navigate rather than silently do nothing.
   */
  go(href: string) {
    if (go) return go(href)
    if (typeof location !== 'undefined') location.href = href
  },
}

/** Called by the shell on every navigation. */
export function setNavigation(next: {
  pathname: string
  params: Record<string, string>
  search: URLSearchParams | Record<string, string>
  go?: (href: string) => void
}) {
  pathname = next.pathname
  params = next.params
  search = next.search instanceof URLSearchParams ? Object.fromEntries(next.search) : next.search
  if (next.go) go = next.go
}
