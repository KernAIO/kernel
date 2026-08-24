---
'@kernhq/contracts': minor
'@kernhq/kernel': minor
---

Add capabilities: sub-features of a module a workspace can switch off on its own.

A module is the coarse switch — turning one off removes all of it. That is too blunt for a module
whose customers want different amounts of it, and the alternatives are a code fork or a screen full
of controls that do nothing. A capability is the finer switch.

- `defineCapabilities()` declares them with dependencies, defaults and a level; it validates at
  import time, so an unknown or circular `dependsOn` fails when the module loads rather than when
  somebody flips a switch.
- `resolveCapabilities()` is the single closure both halves use: defaults applied, `required` forced
  on, and anything whose dependency is off pruned transitively.
- `requiresCapability(moduleId, id)` gates a procedure. It answers **404, not 403** — a permission
  failure means "this exists and you may not have it", which is wrong for a workspace that does not
  have the feature at all, and it would contradict a shell that has already hidden the navigation.
- Client contributions (`nav`, `routes`, `commands`, `sidebar`, `widgets`, `settingsPages`) take an
  optional `capability`, filtered exactly like `permission`.
- `ModuleManifest.capabilities` and `WorkspaceModuleState.capabilities` are defaulted, so every
  module published before this keeps validating and reports none.

Switches live under a reserved `$capabilities` key in the module's settings jsonb, which is why
turning one off destroys nothing: the rows stay, and turning it back on restores what was there.
