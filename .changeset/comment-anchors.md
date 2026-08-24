---
'@kernhq/ui': minor
---

Anchor comments to a collaborative document.

`CollaborativeEditor` takes `commentRanges` and draws them, and reports a selection as a pair of
**Yjs relative positions** through `oncomment`. A character offset would name a place that only
exists while nobody else is typing — two words inserted above and the remark is attached to text it
was never about. A relative position points at the content, so it survives concurrent editing and
resolves to nothing when the text is deleted, which lets an interface say a thread is orphaned
rather than highlighting an arbitrary sentence.

Highlights are ProseMirror decorations, not marks: a comment is not part of the document, and a mark
would put one person's annotation into everybody's content and into every export.
