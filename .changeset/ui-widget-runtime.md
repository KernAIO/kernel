---
'@kernhq/ui': minor
---

Add `WidgetState`, the widget settings helpers, a shared `common` message bundle, and `apiBaseUrl`
on the host.

The common bundle is the handful of words every module needs and none of them owns — Save, Cancel,
Retry, Loading. Without it each module carries its own translation of "Save": six copies of the same
word, drifting apart, six chances for a locale to be missed. They are lifted from the shell's own
catalogues rather than written fresh, so they read exactly as they do everywhere else.

`apiBaseUrl` retires the per-module `env.PUBLIC_API_URL || 'http://localhost:4200'`. Nine files
carried their own copy of that line, which is nine chances for one to be wrong and fail as a
connection refused with no clue which module owned it.
