---
'@kernhq/contracts': minor
'@kernhq/kernel': minor
---

Platform versioning, the update contract, and safer migrations.

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
