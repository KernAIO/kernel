---
'@kernhq/ui': minor
---

Give the design system one layer scale, so a popup opened from a dialog is on top of it

A `Select` inside a `Dialog` rendered underneath the dialog overlay and could not be operated with
a mouse at all: the popup said `z-index: 60`, the overlay said `70`, both are portalled to `<body>`,
and the overlay won. In Quire that made every column type except Text, and the board, gallery, list
and calendar view kinds, unreachable with a pointer — and it was never only Quire, because it is
every dialog in Kern that contains a select, a menu or a popover.

The numbers are now `--kern-z-*` tokens in `tokens.css`, ordered by a rule rather than by whoever
wrote the component first: a popup is opened *from* a surface and a surface is never opened from a
popup, so every menu, select and popover sits above every drawer, sheet, dialog and command palette.
`layers.test.ts` reads the scale back and fails when a component invents a number of its own.

Two things came out with it:

- The popup surface (`.kmenu`, `.kmenu-item` and the rest) has moved from `MenuItems.svelte` into
  `styles/menu.css`, which `styles/index.css` imports. `Select` emits those classes without
  rendering `MenuItems`, so an app that used a select and no menu could have the stylesheet tree-
  shaken away and shipped a popup with no ground, no border and no layer. Also exported as
  `@kernhq/ui/styles/menu.css`.
- The wiki page's drag grip is hidden until the plugin places it, which is what its comment always
  claimed. It keyed on a `hide` class nothing has ever added, so the rule was inert and the grip sat
  in the top-left corner of the editor from first paint until the first pointer move.

A `note` callout also renders in colour now. `CALLOUT_TONES` has five tones and `prose.css` dressed
four, so `note` — a valid tone, which therefore never reaches the fallback — came out undressed.
`callout.test.ts` checks the two lists against each other.
