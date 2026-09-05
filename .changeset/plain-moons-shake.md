---
'@kernhq/contracts': minor
'@kernhq/kernel': patch
---

`WorkspaceSummary` carries `archivedAt`, and a failed cache no longer refuses a permission check.

An archived workspace is also how a *scheduled deletion* looks, because the workspace is archived
the moment the 30-day grace period starts. Without this field a client cannot tell a workspace on
its way out from one that is simply gone, so it cannot offer the undo the terms promise. It is
`.nullish()` so that adding it does not break anything that constructs a summary.

`Authz` routes every cache call through one guard: an unreachable Valkey was throwing ioredis'
`MaxRetriesPerRequestError` out of `effective()`, so `core.workspaces.myPermissions` answered 500
while `/api/health` stayed green — every permission-gated screen rendered empty on an instance
reporting itself healthy. A failed read is now a miss, a failed write a no-op, and the failure is
reported to the kernel log.
