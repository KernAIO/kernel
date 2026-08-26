---
'@kernhq/ui': patch
---

`--kern-ink-250` clears 4.5:1 in both palettes, against the surface it actually sits on.

The muted end of the ink scale documents an invariant — each step below 450 is the most muted colour
of its hue that still clears 4.5:1 — and the light palette computed it against `--kern-canvas`. That
is the wrong ground. A pill tab's count and a chip both sit on `--kern-surface-active`, a shade more
tinted, where `250` measured 4.45:1. It also missed against canvas itself, at 4.49:1, so the
invariant was false for the bottom step on both surfaces. The dark palette named the right ground
already and still missed it, at 4.495:1.

Both move one step — `#6f6756` → `#6e6655` and `#9b9384` → `#9c9485` — for 4.52:1 and 4.55:1 on the
most tinted surface either sits on. Every step above the bottom one already cleared that ground, so
the scale keeps its order and its spacing, and the comment now names the surface the numbers were
actually computed against.

Found by the shell's UX sweep on the HR org chart, the first screen to put a count in a pill tab.
Each of the three misses is a hundredth of a ratio: invisible by eye in either direction, which is
the whole argument for computing a contrast rather than looking at it.
