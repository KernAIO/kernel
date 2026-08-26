---
'@kernhq/ui': minor
---

Add `buildPageExtensions()` — the wiki page schema — beside the existing narrow one.

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
