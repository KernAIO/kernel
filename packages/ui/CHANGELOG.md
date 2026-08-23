# @kernhq/ui

## 0.4.0

### Minor Changes

- 2caf0c2: A module owns its sidebar, and `slots` is gone.

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

### Patch Changes

- Updated dependencies [2caf0c2]
  - @kernhq/kernel@0.3.0

## 0.3.1

### Patch Changes

- 4a55e99: `RichTextEditor` announces itself as a text box.

  A `contenteditable` div carries no implicit role, so the editor was a control a screen reader read
  as nothing — and nothing could ask for it by role either, which is why a composer could only be
  found by test id. It now sets `role="textbox"` and `aria-multiline="true"` alongside the
  `aria-label` it already had.

## 0.3.0

### Minor Changes

- 0a89f1b: A module can put a card on the workspace dashboard.

  `ClientModule` gains `widgets`, a list of `WidgetDefinition`s: a title, a description, an icon, a
  permission, the sizes the card may be given, and a declarative settings schema the shell turns into
  a form. The shell owns the frame — the card, the header, the drag grip, the menu, and the loading,
  empty, error and no-longer-available states — so a module writes only a body. That split is what
  keeps permission gating and drag handling out of every module, and it is why a widget component is
  never passed its own title.

  `@kernhq/contracts` gains the `dashboard` group on the core contract: a layout per person per
  surface, a layout the workspace hands out, and a policy of `locked`, `default` or `open`. `get`
  returns the resolved answer rather than the raw rows, so no client re-implements the three-by-three
  table of which layout applies.

  **`'dashboard.widget'` is removed from `SlotName`.** It was declared when the slots were first
  written and never contributed to or consumed by anything. A slot says only "render this component
  here", which is not enough to draw a picker from, validate a saved layout against, or generate a
  settings form — so the extension point is a catalogue entry instead. Nothing in or out of this
  workspace named that member; if a third-party module did, it moves to `widgets`.

  Two things worth knowing before writing one:

  - **A preset's contents stay on the client.** A preset is a list of widget ids, and a widget id is a
    client concept the server has never heard of. Core stores which preset applies; the app expands
    it. So reshaping a preset never needs a contracts-first publish, and a client that meets an id it
    does not recognise falls back rather than rendering nothing.
  - **Every setting belongs in the query key.** The shell hands a widget its resolved settings and
    nothing else; if the key ignores them, TanStack serves the cached answer and the setting appears
    to do nothing — on a warm cache only, which is the worst kind of bug to be told about.

  `@kernhq/ui` adds the icons the dashboard needs (`grip-vertical`, `move`, `maximize-2`,
  `minimize-2`, `pin`, `lock-open`, `rotate-ccw`, `timer`, `chart-column`, `chart-line`, `gauge`,
  `layout-dashboard`) and the Svelte-bound widget types.

### Patch Changes

- e49cfaf: Fix `Select`'s `group` option: a group heading was rendered outside `Select.Group`, whose context it
  reads, so any grouped select threw on open and never showed its list.
- Updated dependencies [0a89f1b]
- Updated dependencies [0a89f1b]
- Updated dependencies [0a89f1b]
- Updated dependencies [0a89f1b]
  - @kernhq/kernel@0.2.0

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
