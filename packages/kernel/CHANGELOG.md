# @kernhq/kernel

## 0.7.0

### Minor Changes

- 3bd7675: Module messages can be counted.

  `ClientModule.messages` accepted `Record<string, string>`, so a module could not express a plural at
  all — and a counted message is not a string with `{count}` in it. English has two forms and Arabic
  has six, and which one applies is `Intl.PluralRules`' answer rather than the author's. A message is
  now a string _or_ a map of CLDR plural category to string, and `t(key, { count })` picks the form,
  falling back to `other` — the one category every locale has.

  This is additive for anything already constructing a bundle: a plain string is still a `Message`.

## 0.6.0

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

### Patch Changes

- Updated dependencies [b90f848]
  - @kernhq/contracts@0.5.0

## 0.5.0

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

### Patch Changes

- Updated dependencies [4f7d500]
  - @kernhq/contracts@0.4.0

## 0.4.1

### Patch Changes

- d1b5a33: Relicense the framework under Apache-2.0. These packages are what a third-party module imports, and
  under AGPL nobody could write a closed module for their own instance. The Kern product — app, core,
  chat, mail, collab, docs and the first-party modules — stays AGPL-3.0-only. See LICENSING.md and
  ADR 0005 in the `kern` repository.
- Updated dependencies [d1b5a33]
  - @kernhq/contracts@0.3.1

## 0.4.0

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

### Patch Changes

- Updated dependencies [df96baf]
  - @kernhq/contracts@0.3.0

## 0.3.0

### Minor Changes

- 2caf0c2: A module owns its sidebar, and `slots` is gone.

  `ClientModule` gains `sidebar`: a list of contributions, each naming the path segments it fills, an
  optional control strip, and a component. `''` is the home sidebar, which several modules contribute
  a group to at once — so the tracker's "my work" presets and core's inbox row are declared by the
  modules that own them rather than hardcoded in the application layout, where a workspace with the
  tracker switched off was still shown three rows linking into it.

  Segments are compared exactly. The previous version gated on `pathname.includes('/chat')`, which
  also matched a workspace whose slug was `chat`, and any route that merely contained the word.

  **`slots` and `SlotName` are removed.** Ten slot names were declared; nine never had a contributor
  or a consumer, and the tenth — `sidebar.widget` — is now a typed field that carries what the shell
  actually needs to reason about it: which routes it fills, what may see it, and where its control
  strip goes. A slot passed no context at all, so every contributor cast its argument to a shape the
  signature did not promise. Nothing outside this workspace contributed to any of them.

## 0.2.0

### Minor Changes

- 0a89f1b: Every service now sends a content security policy.

  `createHttpServer` registered helmet with `contentSecurityPolicy: false`, so nothing constrained what
  a response could load or who could frame it. A JSON API renders nothing, so it now says exactly
  that — `default-src 'none'`, plus `frame-ancestors`, `base-uri` and `form-action` set to `'none'`.

  This is a behaviour change for any service that serves HTML from a kernel-hosted route: it will be
  blocked unless it sets its own header. Core's `/api/docs` is the one such route today and does.

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

### Patch Changes

- Updated dependencies [0a89f1b]
- Updated dependencies [0a89f1b]
- Updated dependencies [0a89f1b]
- Updated dependencies [0a89f1b]
  - @kernhq/contracts@0.2.0

## 0.1.1

### Patch Changes

- 35079b2: Answer `MODULE_DISABLED` with HTTP 403 instead of 500.

  `workspaceScoped()` threw `ORPCError('MODULE_DISABLED')` without a status. oRPC only knows its own
  standard codes and falls back to 500 for everything else, so a workspace that had simply switched a
  module off got an opaque "Internal error" over both the REST and the RPC surface. The middleware now
  passes the status `httpStatusFor` defines, along with a message. Every module behind
  `workspaceScoped` is affected, so consumers need this version to get the 403.
