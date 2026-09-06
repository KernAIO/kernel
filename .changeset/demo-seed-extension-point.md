---
'@kernhq/contracts': patch
'@kernhq/kernel': patch
---

Add a demo-content extension point, so a new workspace can be created already full.

A module may now declare `demo: { seed }` on its `ServerModule`. The kernel subscribes it to
`core.workspace.demo_seed` — the event core publishes when a workspace is created with
`CreateWorkspace.seedDemo` — and hands it the workspace, the owner's id, a service principal
carrying that owner so what it writes has an author, and the instant to anchor its dates to. A
seeder that throws is logged and costs its own content only; the workspace has already been created
and its owner is already in it.

Both changes are additive and released as patches deliberately: an optional field on
`CreateWorkspace` and an optional field on `ServerModule` are reachable by every existing `^0.8.0`
and `^0.10.0` range, so no consumer has to move before it wants the feature. A minor here would
invalidate every `@kernhq/*` range in the organisation at once for one optional field.
