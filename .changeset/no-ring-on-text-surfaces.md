---
'@kernhq/ui': patch
---

A page's reading column is centred, and a document body draws no focus ring.

`maxWidth` on `Page` describes a *measure*, not a left margin — but `.inner` had no `margin-inline`,
so a 780px document column sat against the left edge of a 1352px area with 540px of dead space
beside it. Measured, not guessed. A page that sets no `maxWidth` is already full width, so `auto`
changes nothing there.

And `CollaborativeEditor`'s surface wore a border the moment anybody clicked into it: the design
system's global `:focus-visible` rule draws a 3px `box-shadow`, and the component cleared only
`outline`, which is a different property. A caret and a selection are what tell you a text surface
has focus — every word processor works this way — and a box drawn around the whole document is the
thing that reads as unfinished. Removed for this surface alone; a comment box or an issue
description is a discrete field among other controls and keeps its ring.
