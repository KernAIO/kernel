---
'@kernhq/contracts': patch
'@kernhq/kernel': patch
'@kernhq/sdk': patch
'@kernhq/testing': patch
'@kernhq/tsconfig': patch
'@kernhq/ui': patch
---

Relicense the framework under Apache-2.0. These packages are what a third-party module imports, and
under AGPL nobody could write a closed module for their own instance. The Kern product — app, core,
chat, mail, collab, docs and the first-party modules — stays AGPL-3.0-only. See LICENSING.md and
ADR 0005 in the `kern` repository.
