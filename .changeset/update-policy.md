---
'@kernhq/contracts': minor
---

An instance decides how it updates, in one place.

`UpdateChannel` becomes `UpdatePolicy`: a mode (`off`, `notify`, `auto`), a window with a time zone,
and how long a release must have been out before the instance takes it on its own. There is one
policy for the platform rather than one per module, for the same reason there is one version.

Adds `UpdatePlan` — what an automatic upgrade would do right now and why — so the thing on the host
that applies an upgrade asks the instance rather than deciding for itself, and `AutoUpdateAttempt`,
so a failed automatic upgrade is visible and is not retried until a person has looked.
