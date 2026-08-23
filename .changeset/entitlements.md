---
'@kernhq/contracts': minor
'@kernhq/kernel': minor
---

A workspace can be told what its plan allows, without the platform knowing who sells it.

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
