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
/**
 * Options the shell's router understands. Named here rather than imported from `@sveltejs/kit`,
 * which the framework must not depend on — but a module genuinely needs `replaceState` (an edit
 * that should not add a history entry) and `keepFocus` (a navigation that must not steal focus from
 * what somebody is typing in).
 */
export interface NavigateOptions {
  replaceState?: boolean
  keepFocus?: boolean
  noScroll?: boolean
  invalidateAll?: boolean
}

/** What a module says the current view is called; the shell decides where that shows. */
export interface ViewDescription {
  label?: string
  icon?: string
}

let go: ((href: string, opts?: NavigateOptions) => void) | null = null
let describe: ((view: ViewDescription) => void) | null = null

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
  /**
   * Name the view the module is currently showing.
   *
   * The shell can only name a screen from its URL — "Chat" — while the module knows it is
   * `eng-core`. It used to reach into the app's tab-strip state to say so, which a package cannot
   * do; now it states the fact and the shell decides what to do with it. An instance with the tab
   * strip turned off simply does nothing with it, which is the right outcome: a module should not
   * know whether tabs exist.
   */
  describe(view: ViewDescription) {
    describe?.(view)
  },

  go(href: string, opts?: NavigateOptions) {
    if (go) return go(href, opts)
    if (typeof location === 'undefined') return
    // No shell router, so the options cannot be honoured — but `replaceState` at least has a
    // faithful equivalent, and losing it would put a history entry where the caller said not to.
    if (opts?.replaceState) return history.replaceState(null, '', href)
    location.href = href
  },
}

/** Called by the shell on every navigation. */
export function setNavigation(next: {
  pathname: string
  params: Record<string, string>
  search: URLSearchParams | Record<string, string>
  go?: (href: string, opts?: NavigateOptions) => void
  describe?: (view: ViewDescription) => void
}) {
  pathname = next.pathname
  params = next.params
  search = next.search instanceof URLSearchParams ? Object.fromEntries(next.search) : next.search
  if (next.go) go = next.go
  if (next.describe) describe = next.describe
}
