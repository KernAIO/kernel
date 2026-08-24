---
'@kernhq/contracts': minor
'@kernhq/kernel': minor
---

Declare the collab boundary in the contracts, and let a service migrate its own schema.

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
