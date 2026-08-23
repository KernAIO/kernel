---
'@kernhq/kernel': minor
'@kernhq/ui': minor
---

A module owns its sidebar, and `slots` is gone.

`ClientModule` gains `sidebar`: a list of contributions, each naming the path segments it fills, an
optional control strip, and a component. `''` is the home sidebar, which several modules contribute
a group to at once — so the tracker's "my work" presets and core's inbox row are declared by the
modules that own them rather than hardcoded in the application layout, where a workspace with the
tracker switched off was still shown three rows linking into it.

Segments are compared exactly. The previous version gated on `pathname.includes('/chat')`, which
also matched a workspace whose slug was `chat`, and any route that merely contained the word.

**`slots` and `SlotName` are removed.** Ten slot names were declared; nine never had a contributor
or a consumer, and the tenth — `sidebar.widget` — is now a typed field that carries what the shell
actually needs to reason about it: which routes it fills, what may see it, and where its control
strip goes. A slot passed no context at all, so every contributor cast its argument to a shape the
signature did not promise. Nothing outside this workspace contributed to any of them.
