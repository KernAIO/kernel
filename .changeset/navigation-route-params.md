---
'@kernhq/ui': minor
---

`setRouteParams` — so `navigation.params` carries the parameters a module's own route matched.

Route parameters arrive in two halves. The shell's layout publishes SvelteKit's, which for a module
URL are `{ws, module}` where `module` is the whole unparsed rest of the path; the `:space`/`:page` a
module declares are matched one level below by the module router and handed to the page component as
props. Anything *outside* the route component therefore read `undefined`.

Quire's sidebar is outside the route. It picks the space to draw from `navigation.params.space`, got
nothing, and fell back to the first space in the list — so standing in any space but the first it
listed a different space's pages, said that space's name, and every row in it navigated you out of
the one you were reading. A sidebar confidently showing the wrong thing is worse than one showing
nothing.

The two halves are now kept separately and merged, so either can be republished without dropping or
resurrecting the other: the module route mount publishes its half and clears it on teardown, and a
shell-side update no longer wipes it.
