---
'@kernhq/kernel': patch
---

`rlsPolicySql` now emits `drop policy if exists` before `create policy`, so a module migration
written the documented way survives being applied twice.

`create policy` has no `if not exists`, and drizzle keys applied migrations by content hash — so
editing any file in a module's folder replays the whole folder against a schema that already has
its objects. A module migration that throws does not degrade its own feature; the kernel migrates
every module at boot, so it takes down the host service and every other module in it.

Three module READMEs and three `drizzle.config.ts` comments name this helper as the way to write a
policy. The first-party modules had all been hand-patched with the drop, and their migration
headers described the helper as emitting what it did not, so the defect was only reachable by
someone following the documented path for the first time — a third-party module author.
