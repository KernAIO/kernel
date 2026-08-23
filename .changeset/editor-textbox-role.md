---
'@kernhq/ui': patch
---

`RichTextEditor` announces itself as a text box.

A `contenteditable` div carries no implicit role, so the editor was a control a screen reader read
as nothing — and nothing could ask for it by role either, which is why a composer could only be
found by test id. It now sets `role="textbox"` and `aria-multiline="true"` alongside the
`aria-label` it already had.
