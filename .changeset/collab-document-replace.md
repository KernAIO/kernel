---
'@kernhq/contracts': patch
---

Declare `collab.document.replace`.

Restoring a version cannot be done with `document.apply`: `Y.applyUpdate` *merges*, so feeding an
older state back produces the union of old and new — every deleted paragraph returning alongside the
ones that replaced it. Replacing is a different operation and belongs where the CRDT is understood,
rather than being reimplemented by every module that keeps history.
