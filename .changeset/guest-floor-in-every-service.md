---
'@kernhq/kernel': patch
---

Apply the guest deny-floor in `Authz.effective()`, from the permissions the asking process
registered. The floor was enumerated in core alone, so a module hosted in another service — chat,
mail, collab — had its keys absent from it and its guests were not restrained at all.
