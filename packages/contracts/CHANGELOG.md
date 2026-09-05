# @kernhq/contracts

## 0.8.0

### Minor Changes

- c65ba11: `WorkspaceSummary` carries `archivedAt`, and a failed cache no longer refuses a permission check.

  An archived workspace is also how a _scheduled deletion_ looks, because the workspace is archived
  the moment the 30-day grace period starts. Without this field a client cannot tell a workspace on
  its way out from one that is simply gone, so it cannot offer the undo the terms promise. It is
  `.nullish()` so that adding it does not break anything that constructs a summary.

  `Authz` routes every cache call through one guard: an unreachable Valkey was throwing ioredis'
  `MaxRetriesPerRequestError` out of `effective()`, so `core.workspaces.myPermissions` answered 500
  while `/api/health` stayed green — every permission-gated screen rendered empty on an instance
  reporting itself healthy. A failed read is now a miss, a failed write a no-op, and the failure is
  reported to the kernel log.

## 0.7.0

### Minor Changes

- feat(contracts): personal API keys, and a scope on Principal

## 0.6.1

### Patch Changes

- chore(contracts): format mcp.ts so lint passes again

## 0.6.0

### Minor Changes

- 696cda5: New `mcp` contract group on `coreContract`: the pending-authorization, connected-client and token
  procedures behind MCP consent screens and workspace admin surfaces. New exported schemas
  `McpClient`, `McpTokenInfo`, `McpAuthRequestInfo` and the coarse scope shape (`<module>:read|write`).
  Additive for parsing and constructing — no existing field changed.

## 0.5.2

### Patch Changes

- docs: update repo references for kern->app and app->shell rename

## 0.5.1

### Patch Changes

- 90ce41a: Declare `collab.document.replace`.

  Restoring a version cannot be done with `document.apply`: `Y.applyUpdate` _merges_, so feeding an
  older state back produces the union of old and new — every deleted paragraph returning alongside the
  ones that replaced it. Replacing is a different operation and belongs where the CRDT is understood,
  rather than being reimplemented by every module that keeps history.

## 0.5.0

### Minor Changes

- b90f848: Declare the collab boundary in the contracts, and let a service migrate its own schema.

  `@kernhq/contracts` now owns the document naming (`formatCollabDocument` / `parseCollabDocument`),
  the `collab.access` input and output, the `collab.document.*` procedure shapes, and a typed
  `collab.document.updated` event. Both sides of that call compile against one definition — the first
  module to implement `collab.access` declared different shapes from the ones the gateway sends and
  reads, so the call failed validation on every request and the gateway fell back to plain workspace
  membership without anyone noticing.

  `Database.migrateSchema(schema, folder, lockKey?)` applies a migrations folder to any schema, not
  only to `mod_<id>`. A service that owns tables of its own gets migrations for the same reasons a
  module does. `migrateModule` now delegates to it and keeps taking the bare module id as its advisory
  lock key, so a rolling deploy cannot end up with two images holding different keys for the same
  folder.

## 0.4.0

### Minor Changes

- 4f7d500: Add capabilities: sub-features of a module a workspace can switch off on its own.

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

## 0.3.1

### Patch Changes

- d1b5a33: Relicense the framework under Apache-2.0. These packages are what a third-party module imports, and
  under AGPL nobody could write a closed module for their own instance. The Kern product — app, core,
  chat, mail, collab, docs and the first-party modules — stays AGPL-3.0-only. See LICENSING.md and
  ADR 0005 in the `kern` repository.

## 0.3.0

### Minor Changes

- df96baf: Report what a module actually registered, rather than what it declared.

  `describeModule()` walks a module's contract and its router and compares them — the same check every
  module's own test does, now runnable against a live instance. It answers the question somebody
  building a module asks every few minutes and nothing could answer before: is it wired up, is every
  procedure it promised implemented, and what stands in front of each one.

  `admin.diagnostics` on the core contract returns it. The existing `admin.modules` reported a manifest
  and a hardcoded `healthy: true`.

  Two things it deliberately does not do. It does not judge how many middlewares a procedure carries —
  a module following the template has two, and core's `admin.*` checks inside the handler instead, so
  the count is shown rather than scored. And it reports procedures reachable without signing in as
  **public** rather than as a fault: a health check and an intake form are meant to be, but nobody kept
  that list, and a procedure that lands on it by accident is invisible until somebody finds it.

  `contract` is now attached to every first-party module's `defineServerModule`. It was optional and
  nothing set it, so the comparison had nothing to compare against.

## 0.2.0

### Minor Changes

- 0a89f1b: A module can put a card on the workspace dashboard.

  `ClientModule` gains `widgets`, a list of `WidgetDefinition`s: a title, a description, an icon, a
  permission, the sizes the card may be given, and a declarative settings schema the shell turns into
  a form. The shell owns the frame — the card, the header, the drag grip, the menu, and the loading,
  empty, error and no-longer-available states — so a module writes only a body. That split is what
  keeps permission gating and drag handling out of every module, and it is why a widget component is
  never passed its own title.

  `@kernhq/contracts` gains the `dashboard` group on the core contract: a layout per person per
  surface, a layout the workspace hands out, and a policy of `locked`, `default` or `open`. `get`
  returns the resolved answer rather than the raw rows, so no client re-implements the three-by-three
  table of which layout applies.

  **`'dashboard.widget'` is removed from `SlotName`.** It was declared when the slots were first
  written and never contributed to or consumed by anything. A slot says only "render this component
  here", which is not enough to draw a picker from, validate a saved layout against, or generate a
  settings form — so the extension point is a catalogue entry instead. Nothing in or out of this
  workspace named that member; if a third-party module did, it moves to `widgets`.

  Two things worth knowing before writing one:

  - **A preset's contents stay on the client.** A preset is a list of widget ids, and a widget id is a
    client concept the server has never heard of. Core stores which preset applies; the app expands
    it. So reshaping a preset never needs a contracts-first publish, and a client that meets an id it
    does not recognise falls back rather than rendering nothing.
  - **Every setting belongs in the query key.** The shell hands a widget its resolved settings and
    nothing else; if the key ignores them, TanStack serves the cached answer and the setting appears
    to do nothing — on a warm cache only, which is the worst kind of bug to be told about.

  `@kernhq/ui` adds the icons the dashboard needs (`grip-vertical`, `move`, `maximize-2`,
  `minimize-2`, `pin`, `lock-open`, `rotate-ccw`, `timer`, `chart-column`, `chart-line`, `gauge`,
  `layout-dashboard`) and the Svelte-bound widget types.

- 0a89f1b: A workspace can be told what its plan allows, without the platform knowing who sells it.

  Adds `kernel.entitlements`: seats, storage, allowed modules, SSO, audit retention and API rate, asked
  from the side that enforces a limit rather than the side that charges for it. Core hosts modules and
  so cannot import one, so it asks through the kernel instead — the same shape `Settings` already uses
  to reach core's own procedures from services that do not contain them.

  When no module answers `billing.entitlements.get`, every workspace is unlimited. That is not a
  fallback for an error case: it is what every self-hosted instance does on every request, so the path
  is the default and cannot throw.

  The keys are a fixed vocabulary while their values are data. A plan may set any of them, but it
  cannot invent one, because each key has exactly one place in the codebase that enforces it — a limit
  nothing checks is how a pricing page starts making promises the product does not keep.

  Also: `ClientSettingsPage.scope` gains `instance`, so a module can contribute a page to the admin
  console instead of the app hand-mounting the route; and core gains `core.file.deleted`, without which
  storage usage only ever grows. `core.file.ready` carries an optional `size` — optional so a rolling
  deploy, where an older core emits alongside a newer consumer, does not drop the event on validation.

- 0a89f1b: Platform versioning, the update contract, and safer migrations.

  - The kernel reports `KERN_VERSION` — the release the image was built as — instead of a constant
    each service kept for itself. `/api/health` now returns every module's id **and** version, which
    is what the release-feed generator reads out of a built image.
  - Modules may declare `minKernel`. The kernel checks it before any migration runs and refuses to
    boot with a message naming the module, the requirement and the running version. Unreleased builds
    (`0.0.0-dev`) skip the check so local development still starts.
  - `migrateModule` takes a Postgres advisory lock for the whole run. Several processes migrate on
    boot — Compose starts `core` and `core-worker` together — and without it they interleave and one
    fails on a relation another has just created. `create ... if not exists` races the same way, so
    schema creation moved inside the lock and catalogue duplicate errors are treated as success.
  - `kernel.maintenance` closes the API with 503 and `Retry-After` while an upgrade is applying, so
    the interface can say "come back in a moment" instead of showing failed requests. It lives in a
    kernel-owned schema because the services that read it run while core is down migrating.
  - `core.admin.updates` contract: what this instance runs, the newest stable release, the per-module
    version diff, anything blocking the upgrade, and the command that applies it.

- 0a89f1b: An instance decides how it updates, in one place.

  `UpdateChannel` becomes `UpdatePolicy`: a mode (`off`, `notify`, `auto`), a window with a time zone,
  and how long a release must have been out before the instance takes it on its own. There is one
  policy for the platform rather than one per module, for the same reason there is one version.

  Adds `UpdatePlan` — what an automatic upgrade would do right now and why — so the thing on the host
  that applies an upgrade asks the instance rather than deciding for itself, and `AutoUpdateAttempt`,
  so a failed automatic upgrade is visible and is not retried until a person has looked.
