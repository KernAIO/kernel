---
'@kernhq/ui': minor
---

Give the page editor a `/` menu, and make `@` work in a page at all

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
