# @kernhq/contracts

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
