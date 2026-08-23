# @kernhq/ui

## 0.2.0

### Minor Changes

- fd91eb8: `RailLogo` draws the Kern mark instead of a styled letter.

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

## 0.1.2

### Patch Changes

- 0c94041: Add the `bug` and `git-branch` icons.

  The tracker's project templates name both — Bug and Sub-task have used them since work item types
  existed — and neither was in the registry, so both rendered as a blank square. An unregistered name
  fails silently, and a name chosen in one repository and rendered in another is exactly where that
  goes unnoticed.

## 0.1.1

### Patch Changes

- 5e00e9c: Focus the first control in a dialog's body instead of its close button.

  The close button is the first tabbable element in the markup, so it took focus whenever a dialog
  opened. In a dialog whose point is to type something — a new issue, a rename — the first space went
  to the close button and threw the draft away. `Dialog` now moves focus to the first control in its
  body on open, and takes an `initialFocus` prop (an element getter, a selector, or `false` to opt
  out) when that is not the right one. A dialog with nothing focusable in its body keeps the old
  behaviour: activating close is a safe thing for a confirmation to do.

- Updated dependencies [35079b2]
  - @kernhq/kernel@0.1.1
