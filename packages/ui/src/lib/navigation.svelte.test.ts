/**
 * Route parameters arrive in two halves and both have to survive.
 *
 * The shell's layout publishes SvelteKit's params — for a module URL that is `{ws, module}`, where
 * `module` is the whole unparsed rest of the path — while the `:space`/`:page` a module declares
 * are matched one level below by the module router. Anything outside the route component read only
 * the first half, so Quire's sidebar picked its space from `params.space`, got `undefined`, and
 * fell back to the first space in the list: in any space but the first it drew a different space's
 * pages and every row navigated you out of the one you were reading.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { navigation, setNavigation, setRouteParams } from './navigation.svelte.js'

const shellParams = (module: string) => ({ ws: 'northstar', module })

const publishShell = (module: string) =>
  setNavigation({ pathname: `/northstar/${module}`, params: shellParams(module), search: {} })

describe('navigation params', () => {
  beforeEach(() => {
    setRouteParams({})
    publishShell('quire')
  })

  it('keeps what the shell matched', () => {
    expect(navigation.params.ws).toBe('northstar')
    expect(navigation.workspaceSlug).toBe('northstar')
  })

  it('adds what the module route matched', () => {
    setRouteParams({ space: 'engineering', page: 'p-1' })
    expect(navigation.params.space).toBe('engineering')
    expect(navigation.params.page).toBe('p-1')
    expect(navigation.params.ws, 'the shell half survived').toBe('northstar')
  })

  /*
   * The order the two arrive in is not fixed — a layout effect and a route mount are both reactive
   * — so a shell update must not drop the module half. This is the regression: without it the
   * sidebar's space blinks back to the first one on any navigation the layout re-publishes.
   */
  it('survives the shell republishing after the module route did', () => {
    setRouteParams({ space: 'engineering' })
    publishShell('quire/engineering')
    expect(navigation.params.space).toBe('engineering')
    expect(navigation.params.ws).toBe('northstar')
  })

  it('forgets the last page when a route publishes nothing', () => {
    setRouteParams({ space: 'engineering', page: 'p-1' })
    setRouteParams({})
    expect(navigation.params.page, 'the page you left must not outlive it').toBeUndefined()
  })

  it('lets the module half win where the two disagree', () => {
    // `module` is the shell's unparsed rest; a module declaring a param of that name means its own.
    setRouteParams({ module: 'the-module-route-meant-this' })
    expect(navigation.params.module).toBe('the-module-route-meant-this')
  })
})
