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
/*
 * `params` is the merge of two halves, and each is kept so that either can be republished without
 * dropping — or resurrecting — the other. Merging into `params` directly cannot express "the module
 * route now matches nothing", which is what leaving a page looks like: the page you left would
 * outlive it.
 */
let shellParams: Record<string, string> = {}
let routeParams: Record<string, string> = {}
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
  /**
   * Route parameters the shell matched, including `ws` — the workspace slug — and the ones the
   * *module's own* route declared, such as `:space` and `:page`.
   *
   * Both halves matter and for a while only the first arrived. The shell's layout publishes
   * SvelteKit's params, which for a module URL are `{ws, module}` — `module` being the whole
   * unparsed rest of the path — while the `:space`/`:page` a module declares are matched separately
   * by `resolveModuleRoute` and handed to the page component as props. Anything outside the route
   * therefore read `undefined`, and Quire's sidebar, which picks the space to draw from
   * `params.space`, fell back to the first space in the list: standing in any space but the first,
   * it listed a different space's pages and every row navigated you out of the one you were
   * reading. A sidebar confidently showing the wrong thing is worse than one showing nothing.
   */
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
  // Route params arrive in two halves; keep whichever the module route published for this path.
  shellParams = next.params
  params = { ...shellParams, ...routeParams }
  search = next.search instanceof URLSearchParams ? Object.fromEntries(next.search) : next.search
  if (next.go) go = next.go
  if (next.describe) describe = next.describe
}

/**
 * The parameters a *module's own* route declaration matched, merged over the shell's.
 *
 * `setNavigation` is called from the shell's layout, which cannot know them: `:space` and `:page`
 * are matched by the module router one level below it, at a point where re-publishing the whole
 * navigation object would clobber the fields the layout owns. So the module route mount publishes
 * only its half, and this merges.
 *
 * Call it with `{}` when leaving a module route, or the last page's parameters outlive the page.
 */
export function setRouteParams(next: Record<string, string>) {
  routeParams = next
  params = { ...shellParams, ...routeParams }
}
