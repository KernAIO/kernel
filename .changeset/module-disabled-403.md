---
'@kernhq/kernel': patch
---

Answer `MODULE_DISABLED` with HTTP 403 instead of 500.

`workspaceScoped()` threw `ORPCError('MODULE_DISABLED')` without a status. oRPC only knows its own
standard codes and falls back to 500 for everything else, so a workspace that had simply switched a
module off got an opaque "Internal error" over both the REST and the RPC surface. The middleware now
passes the status `httpStatusFor` defines, along with a message. Every module behind
`workspaceScoped` is affected, so consumers need this version to get the 403.
