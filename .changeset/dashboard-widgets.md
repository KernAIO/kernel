---
'@kernhq/contracts': minor
'@kernhq/kernel': minor
'@kernhq/ui': minor
---

A module can put a card on the workspace dashboard.

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
