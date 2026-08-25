---
'@kernhq/ui': minor
---

Add the `navigation` singleton and `collabUrl` on the host.

A module cannot import `$app/navigation` or `$app/state`: those are SvelteKit aliases, and a module
package is compiled and type-checked on its own, where they do not exist. They *appear* to work
while the module is edited inside the app — which is exactly how the dependency gets added without
anyone noticing, and why it only fails once the package is built standalone. The shell publishes the
current location here on every navigation, and modules read it.

A route component rarely needs it — the shell passes `params` and `workspaceSlug` as props. It is
for the parts that sit outside a route: a sidebar highlighting the open page, a presenter rendering
inside somebody else's screen.
