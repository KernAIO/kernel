# @kernhq/ui

## 0.11.0

### Minor Changes

- 5ff8525: `CollaborativeEditor` takes a `label`, so the surface people write on has a name.

  A contenteditable div has no implicit role, so the component gives it `role="textbox"` — and a
  textbox with no accessible name is announced as nothing at all. `RichTextEditor` has carried this
  prop since it was written; this one never did, which made the wiki's _main_ writing surface the one
  nameless control in the product. It is optional for source compatibility and should always be
  passed.

## 0.10.1

### Patch Changes

- Updated dependencies
  - @kernhq/contracts@0.7.0
  - @kernhq/kernel@0.7.3
  - @kernhq/sdk@0.1.9

## 0.10.0

### Minor Changes

- 222ad54: Give the page editor a `/` menu, and make `@` work in a page at all

  The wiki block set has been in the schema and in the renderer since it was written, and there was no
  way to type any of it: no toolbar, no bubble menu, no slash menu. A callout, a table, a toggle and a
  divider had no entry point of any kind. `@` and `+` were worse than that — `buildPageExtensions` has
  asked for `onSuggest` and `onPageSuggest` since the day it was added, and `CollaborativeEditor` never
  passed them, so typing `@` in a wiki page opened nothing.

  `/` now offers every block a page can hold — text, all six headings, three kinds of list, quote, code
  block, table, toggle, divider, the five callout tones, and the two mentions — grouped, filtered by
  label or by the words people actually type (`bullet`, `todo`, `hr`), and driven entirely from the
  keyboard while the caret stays in the document. The menu is the same `SuggestionMenu` for all three
  triggers, drawn in Svelte on the shared `.kmenu` surface, so it has the product's tokens, dark mode
  and RTL rather than its own.

  `slash.test.ts` checks the list against `PAGE_DOC_NODES`: a node that no item inserts has to be named
  in `SLASH_STRUCTURAL_NODES` with a reason, so adding a block to the page format and forgetting to
  give anyone a way to type it fails in the same commit. The extension carries no nodes and no marks,
  and `page-schema.test.ts` now passes the new options through its "same schema whatever the options"
  check to keep it that way.

  Two entries depend on the host and are hidden without it: **Image** needs a new `pickImage` prop
  (this package has no upload surface, and a picture is stored by file id), and **Link a page** appears
  only where `pageSource` is wired.

  Labels ship in all five languages the package already speaks — English, Persian, Arabic, German,
  Turkish — as a new `editor.*` bundle registered the same way `common.*` is.

- 4e23275: Give the design system one layer scale, so a popup opened from a dialog is on top of it

  A `Select` inside a `Dialog` rendered underneath the dialog overlay and could not be operated with
  a mouse at all: the popup said `z-index: 60`, the overlay said `70`, both are portalled to `<body>`,
  and the overlay won. In Quire that made every column type except Text, and the board, gallery, list
  and calendar view kinds, unreachable with a pointer — and it was never only Quire, because it is
  every dialog in Kern that contains a select, a menu or a popover.

  The numbers are now `--kern-z-*` tokens in `tokens.css`, ordered by a rule rather than by whoever
  wrote the component first: a popup is opened _from_ a surface and a surface is never opened from a
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

### Patch Changes

- 55dc4ee: Let a `Select` and a `Table` carry their own accessible name

  `Switch` has taken an `ariaLabel` since it was written; `Select` and `Table` never did. A `Select`
  fell back to naming itself after its `placeholder`, which names an empty control well and a filled
  one badly — a status filter showing "Assigned" still announced itself as "All statuses" — and a
  `Table` rendered `role="table"` with no name at all, so a screen reader read "table" and left the
  reader to guess which one.

  Both now accept `ariaLabel`, and both keep exactly their old behaviour when it is not passed.

- fcdc590: Register the icons an asset register needs

  `package`, `boxes`, `warehouse`, `map-pin`, `truck`, `receipt`, `qr-code`, `scan-line` and
  `clipboard-list` join the curated registry. Nothing about the package's API changes — `getIcon`,
  `registerIcons` and `iconNames` keep their signatures, and `registerIcons` already allowed a
  consumer to add these at runtime. What changes is that a module may now name them, which is the
  thing `check-icons.mjs` enforces: an unregistered name renders a blank square and throws nothing,
  so the registry is where an icon becomes real.

  They are here for `module-inventory`, which is growing from an asset register into stock control —
  locations, items, movements, suppliers, purchase orders and printed QR labels each need a name the
  rail and the command palette can draw.

## 0.9.0

### Minor Changes

- 81a3354: Add `buildPageExtensions()` — the wiki page schema — beside the existing narrow one.

  A page can now hold six heading levels, tables, images, task lists, callouts, toggles, highlighted
  code blocks, page mentions and a table of contents, with a drag handle and stable block ids. The
  narrow `buildExtensions()` is untouched, so comments and issue descriptions keep exactly the schema
  they had; `CollaborativeEditor` selects between them with a new `page` prop that defaults to false.

  The node and mark lists are frozen in `@kernhq/ui/editor/page-doc`, a subpath that imports nothing
  and loads in plain Node. That is what a server-side renderer in another repository is checked
  against — `renderPageDoc()` in `@kernhq/module-quire` is the first one.

  Also fixes undo in every collaborative surface. `CollaborativeEditor` filtered an extension named
  `history`, which has not existed since Tiptap v3 renamed it `undoRedo` and moved it inside
  StarterKit — so the filter never removed anything and the editor ran StarterKit's undo stack
  alongside Yjs'. Both builders now switch it off explicitly: `buildExtensions` when the new
  `collaborative` option is set, and `buildPageExtensions` always.

## 0.8.4

### Patch Changes

- Updated dependencies [696cda5]
  - @kernhq/contracts@0.6.0
  - @kernhq/kernel@0.7.2
  - @kernhq/sdk@0.1.8

## 0.8.3

### Patch Changes

- docs: update repo references for kern->app and app->shell rename
- Updated dependencies
  - @kernhq/contracts@0.5.2
  - @kernhq/kernel@0.7.1
  - @kernhq/sdk@0.1.7

## 0.8.2

### Patch Changes

- 6e14235: Treat `welcome`, not the open socket, as the moment the realtime connection exists.

  The client sent its channel subscriptions immediately after `hello`, in the same tick, and the
  gateway closed anything that arrived before it had authenticated the socket — so a good session was
  rejected whenever both frames landed in one read, and the client reconnected into the same race.
  Resetting the backoff on `onopen` made that loop run about twice a second for as long as it lasted.
  Subscriptions now wait for `welcome`, the backoff only resets there, and a first connection no
  longer invalidates every query the page has just run.

- Updated dependencies [6e14235]
  - @kernhq/sdk@0.1.6

## 0.8.1

### Patch Changes

- 4c37134: `@kernhq/kernel` ranges reach the published 0.7.0.

  `^0.6.0` does not admit `0.8.0` or `0.7.0` — a caret on 0.x never crosses a minor — so both packages
  declared a framework they could no longer install. It passed locally because the workspace is
  pinned, and would have failed in any standalone install. `pnpm lint` runs `check-ranges.mjs` now, so
  the next one fails here instead of in a consumer's CI.

## 0.8.0

### Minor Changes

- 3bd7675: Module messages can be counted.

  `ClientModule.messages` accepted `Record<string, string>`, so a module could not express a plural at
  all — and a counted message is not a string with `{count}` in it. English has two forms and Arabic
  has six, and which one applies is `Intl.PluralRules`' answer rather than the author's. A message is
  now a string _or_ a map of CLDR plural category to string, and `t(key, { count })` picks the form,
  falling back to `other` — the one category every locale has.

  This is additive for anything already constructing a bundle: a plain string is still a `Message`.

- 0d6c31e: `session` carries the workspace's resolved capabilities, and `navigation.go` takes router options.

  A module's screens branch on their own capabilities — HR hides the offices column when a workspace
  does not use offices — and they were doing it by importing `capabilitiesOf` from the _app's_ module
  registry and running their own copy of the modules query. A module package cannot import the app,
  and two components asking the same question of the same cache is waste besides.

  `session.hasCapability('hr', 'attendance')` answers it now, from the set the **server** resolved:
  defaults applied, `required` forced on, anything whose dependency is off already pruned. Deriving it
  again on the client would be a second implementation of that closure, and two implementations
  eventually disagree — the way that shows up is a menu item whose API answers 404.

  `navigation.go(href, opts)` accepts `replaceState`, `keepFocus`, `noScroll` and `invalidateAll`.
  Dropping them was a real regression: an edit that should not add a history entry did, and a
  navigation that must not steal focus from what somebody is typing in, did.

- 7b19391: Charts and `formatBytes` join the framework.

  Only tracker draws a chart today, but a chart is a design-system component: the next module that
  wants a trend on its dashboard card should find one rather than build a second. `formatBytes` had
  two copies — attachments and storage limits — which is one too many for a function whose whole job
  is to agree with itself everywhere.

  It keeps 1024 and `KB` rather than `Intl`'s SI `kB`, deliberately: the number sits beside the one the
  operating system's file browser shows, and a size that disagrees with Finder reads as a bug.

- cdf5eab: Complete the host contract: `format`, `i18n`, `realtime`, `uploadFile` and the `Host` seam.

  A module's screens are full of dates, counts, translated strings, presence dots and file
  attachments, and a module cannot import the app — so all of it moves here, keeping the dependency
  pointing one way.

  - **`i18n`** — one message runtime, not one per module. The first draft of this lived in
    `@kernhq/module-chat` with its own `t()` and its own `let locale = 'en'`, which was not reactive:
    switching language left every chat string in the previous one. Keys are namespaced by module, so
    a single merged map per locale is collision-free, and numeric placeholders go through
    `Intl.NumberFormat` so a count on a Persian screen reads ۱۲.
  - **`format`** — everything except `localPlace`, which needs the app's generated CLDR city data.
  - **`realtime`** — `connect()` now takes `{ url, queryClient, getToken }`. It used to read
    `$app/environment` and `$env/dynamic/public` directly, which tied the framework to one
    application's env var names.
  - **`uploadFile`** — still exactly one uploader, three steps, and the third is not optional.
  - **`Host`** — the seam for the few things only the application can build (a configured API client,
    whether it is running against the mock). Deliberately small: every field is something a
    third-party module may depend on for ever.

  `@tanstack/svelte-query` becomes a peer at `^6.1.0` — matching the app rather than guessing, because
  two copies of `query-core` in one tree make `QueryClient` structurally incompatible with itself.

- d85a6a8: Add the host contract a module's own screens need: `session`, `keys`, `createQueryClient`, and the
  `SettingsPage` / `SettingsSection` frames.

  A module cannot import the app, so anything its UI needs from the shell has to live here. The line
  is: **stateless things are exported, stateful things are read from a singleton the shell fills.**
  `keys` and the query defaults are the first kind — a module builds queries and the shell invalidates
  them from realtime `change` messages, so both halves must agree on the `[module, entity, …scope]`
  shape. `session` is the second: `can()` is what decides whether a row, an action or a settings page
  is offered at all.

  One instance of this package in the tree is now load-bearing rather than merely tidy — two copies
  would mean the shell and a module disagreeing about who the user is. `pnpm.overrides` already
  pins it.

  `@kernhq/contracts` becomes a declared dependency: it was imported for types without being named,
  which resolves inside the umbrella and can vanish in a standalone install.

- 190de29: Add the `navigation` singleton and `collabUrl` on the host.

  A module cannot import `$app/navigation` or `$app/state`: those are SvelteKit aliases, and a module
  package is compiled and type-checked on its own, where they do not exist. They _appear_ to work
  while the module is edited inside the app — which is exactly how the dependency gets added without
  anyone noticing, and why it only fails once the package is built standalone. The shell publishes the
  current location here on every navigation, and modules read it.

  A route component rarely needs it — the shell passes `params` and `workspaceSlug` as props. It is
  for the parts that sit outside a route: a sidebar highlighting the open page, a presenter rendering
  inside somebody else's screen.

- 8d02430: Move the shared rich-text pieces into the framework: mentions, emoji, the pickers, voice recording,
  and `navigation.describe`.

  These sat in the app and were used by **two** modules, so they belonged to neither. `mentions.ts` in
  particular typed against `@kernhq/module-chat`'s `RichDoc` while tracker declares an identical one of
  its own — a shared helper picking a winner arbitrarily. `RichDoc` is named structurally here instead;
  if a third module grows rich text, the honest move is to lift it into `@kernhq/contracts` and have
  all of them import it.

  `navigation.describe({ label, icon })` is how a module says what the view it is showing is called.
  The shell can only name a screen from its URL — "Chat" — while the module knows it is `eng-core`.
  Chat used to reach into the app's tab-strip state to say so; now it states the fact and the shell
  decides what to do with it, so an instance with tabs turned off simply does nothing with it. A module
  should not know whether tabs exist.

- aee0c3f: Add `WidgetState`, the widget settings helpers, a shared `common` message bundle, and `apiBaseUrl`
  on the host.

  The common bundle is the handful of words every module needs and none of them owns — Save, Cancel,
  Retry, Loading. Without it each module carries its own translation of "Save": six copies of the same
  word, drifting apart, six chances for a locale to be missed. They are lifted from the shell's own
  catalogues rather than written fresh, so they read exactly as they do everywhere else.

  `apiBaseUrl` retires the per-module `env.PUBLIC_API_URL || 'http://localhost:4200'`. Nine files
  carried their own copy of that line, which is nine chances for one to be wrong and fail as a
  connection refused with no clue which module owned it.

### Patch Changes

- Updated dependencies [3bd7675]
  - @kernhq/kernel@0.7.0

## 0.7.0

### Minor Changes

- 7c4e262: Make every control readable, named and reachable.

  The ink scale ran to 2.5:1 below step 450, six of nine avatar grounds carried white initials below
  4.5:1, four badge tones failed against their own tint, and `.v-danger` put `#fff` on a light red in
  dark mode — on the button that deletes a project. Each is now measured against the palest surface it
  sits on. `--kern-accent-badge-bg` / `-fg` is the pair for text on the accent, which white never
  cleared in either theme.

  `IDENTITY_COLORS` names the `--kern-av-*` tokens instead of repeating their hexes, so the palette
  has one definition and changing it reaches the avatars.

  `Checkbox` and `Switch` render as buttons, which a `<label>` cannot name; both now point
  `aria-labelledby` at their visible text, or adopt an external `<label for>` by id. `SearchBox` and a
  bare `Input` take their name from their placeholder when nothing else names them.

  `PageHeader` sets the browser tab from its title, disabled controls sit at 0.7 rather than 0.5 so
  their labels stay legible, the picker inputs (`file`, `date`, `time`, `color`, `checkbox`, `radio`)
  show a pointer, and the tab close button has a 24px hit area behind its 15px icon.

  Adds `calendar-days`, `check-check`, `toggle-left` and `tree-palm` to the icon registry.

## 0.6.0

### Minor Changes

- 8c4415e: Anchor comments to a collaborative document.

  `CollaborativeEditor` takes `commentRanges` and draws them, and reports a selection as a pair of
  **Yjs relative positions** through `oncomment`. A character offset would name a place that only
  exists while nobody else is typing — two words inserted above and the remark is attached to text it
  was never about. A relative position points at the content, so it survives concurrent editing and
  resolves to nothing when the text is deleted, which lets an interface say a thread is orphaned
  rather than highlighting an arbitrary sentence.

  Highlights are ProseMirror decorations, not marks: a comment is not part of the document, and a mark
  would put one person's annotation into everybody's content and into every export.

## 0.5.0

### Minor Changes

- e3dac06: A collaborative editor.

  `CollaborativeEditor` writes into a Yjs document synchronised through the `collab` service, and
  `createCollabSession` is the plumbing under it — provider, awareness, offline persistence and
  connection status — for anything that wants the pieces without the component.

  Three things it gets right that are invisible when they work: a peer's caret carries their name and
  the colour of their avatar ring, so the cursor in the text and the face in the header are
  recognisably the same person; the surface locks itself when the gateway answers read-only, which it
  does _after_ the socket is already open; and going offline says so and keeps accepting edits rather
  than silently dropping them.

  Undo is already scoped to the local user on this path — y-tiptap's undo plugin tracks only
  `ySyncPluginKey`, and a remote update carries the provider as its origin. The hazard is the reverse
  of the usual advice: supplying a `Y.UndoManager` by hand without `trackedOrigins` is what makes ⌘Z
  undo a colleague's paragraph.

  Tiptap is pinned to `^3.30.3` because the collaboration extensions declare exact peers on
  `@tiptap/core` and `@tiptap/pm` at that version; a looser range resolves two copies of the schema.

## 0.4.4

### Patch Changes

- Updated dependencies [b90f848]
  - @kernhq/kernel@0.6.0

## 0.4.3

### Patch Changes

- Updated dependencies [4f7d500]
  - @kernhq/kernel@0.5.0

## 0.4.2

### Patch Changes

- d1b5a33: Relicense the framework under Apache-2.0. These packages are what a third-party module imports, and
  under AGPL nobody could write a closed module for their own instance. The Kern product — app, core,
  chat, mail, collab, docs and the first-party modules — stays AGPL-3.0-only. See LICENSING.md and
  ADR 0005 in the `kern` repository.
- Updated dependencies [d1b5a33]
  - @kernhq/kernel@0.4.1

## 0.4.1

### Patch Changes

- Updated dependencies [df96baf]
  - @kernhq/kernel@0.4.0

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
