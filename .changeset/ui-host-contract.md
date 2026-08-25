---
'@kernhq/ui': minor
---

Add the host contract a module's own screens need: `session`, `keys`, `createQueryClient`, and the
`SettingsPage` / `SettingsSection` frames.

A module cannot import the app, so anything its UI needs from the shell has to live here. The line
is: **stateless things are exported, stateful things are read from a singleton the shell fills.**
`keys` and the query defaults are the first kind — a module builds queries and the shell invalidates
them from realtime `change` messages, so both halves must agree on the `[module, entity, …scope]`
shape. `session` is the second: `can()` is what decides whether a row, an action or a settings page
is offered at all.

One instance of this package in the tree is now load-bearing rather than merely tidy — two copies
would mean the shell and a module disagreeing about who the user is. `pnpm.overrides` already
pins it.

`@kernhq/contracts` becomes a declared dependency: it was imported for types without being named,
which resolves inside the umbrella and can vanish in a standalone install.
