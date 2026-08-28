---
'@kernhq/ui': minor
---

Eight reading macros in the page schema, and the vocabulary a renderer needs to draw them.

`children`, `excerpt`, `excerpt-include`, `include-page`, `recently-updated`, `contributors`,
`status lozenge` and `expand` are nodes in `buildPageExtensions` — the wide wiki schema only; the
narrow one a comment box and an issue description share is untouched.

`PAGE_DOC_READING_MACROS` is exported alongside them, and it is the point of the export rather than
a convenience: four of the eight *read other pages*, so a renderer has to resolve them against
whoever is reading — and on a public site there is no reader at all. Naming that set in the schema
is what lets the renderer refuse to draw one it cannot resolve, instead of drawing a title nobody
was allowed to see.
