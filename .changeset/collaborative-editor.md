---
'@kernhq/ui': minor
---

A collaborative editor.

`CollaborativeEditor` writes into a Yjs document synchronised through the `collab` service, and
`createCollabSession` is the plumbing under it — provider, awareness, offline persistence and
connection status — for anything that wants the pieces without the component.

Three things it gets right that are invisible when they work: a peer's caret carries their name and
the colour of their avatar ring, so the cursor in the text and the face in the header are
recognisably the same person; the surface locks itself when the gateway answers read-only, which it
does *after* the socket is already open; and going offline says so and keeps accepting edits rather
than silently dropping them.

Undo is already scoped to the local user on this path — y-tiptap's undo plugin tracks only
`ySyncPluginKey`, and a remote update carries the provider as its origin. The hazard is the reverse
of the usual advice: supplying a `Y.UndoManager` by hand without `trackedOrigins` is what makes ⌘Z
undo a colleague's paragraph.

Tiptap is pinned to `^3.30.3` because the collaboration extensions declare exact peers on
`@tiptap/core` and `@tiptap/pm` at that version; a looser range resolves two copies of the schema.
