---
'@kernhq/ui': minor
---

`CollaborativeEditor` takes a `label`, so the surface people write on has a name.

A contenteditable div has no implicit role, so the component gives it `role="textbox"` — and a
textbox with no accessible name is announced as nothing at all. `RichTextEditor` has carried this
prop since it was written; this one never did, which made the wiki's *main* writing surface the one
nameless control in the product. It is optional for source compatibility and should always be
passed.
