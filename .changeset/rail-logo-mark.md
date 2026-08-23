---
'@kernhq/ui': minor
---

`RailLogo` draws the Kern mark instead of a styled letter.

The rail's logo was CSS: a `<span>K</span>` beside a 2×14 accent div, sized off the component's
own `--fs` calculation. That made it a fourth copy of the mark's geometry — after the favicon, the
app icons and the marketing site — and it had already drifted. The letter and the tick were
centred as two independent boxes, so the pair sat visibly left of the square's centre at every
size; the mark centres the two as a group, measuring the K's ink rather than its advance box.

The component now renders the same path and tick as `kern-mark.svg`, filled with
`--kern-ink-inverse` and `--kern-accent`, so the rail matches the tab icon beside it.

**`letter` is removed.** It defaulted to `'K'` and was never passed — the rail shows the product's
mark, not a workspace initial, so the prop only ever offered a way to render something that was not
the Kern logo. Nothing in this workspace set it. A consumer that did wants its own component.

`href`, `label`, `size` and `onclick` are unchanged.
