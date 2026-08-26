/**
 * The wiki page document format, stated once so two repositories can be checked against it.
 *
 * A page is written in the browser by `buildPageExtensions` (next door, in `page-schema.ts`) and
 * drawn on the server by `renderPageDoc` in `@kernhq/module-quire`. Those two live in different
 * repositories under different licences, so nothing links them at compile time — the lists below
 * are the link, and each side has a test that fails when it drifts from them.
 *
 * That is why this file imports nothing. It is loaded by a Node process that has no DOM, no Svelte
 * toolchain and no reason to pull ProseMirror in, so it holds literals and types and no code.
 *
 * **Adding a node or a mark is a three-line change, in this order.** Add it here; the schema test
 * in this package fails until the extension exists, and the renderer test in module-quire fails
 * until there is a case that draws it. Skipping either half is how a writer gets a block the
 * reader cannot see.
 */

/**
 * Every node `buildPageExtensions()` can produce, sorted.
 *
 * `doc` and `text` are in the list although the renderer treats them specially — naming them
 * explicitly is what stops a third exception being smuggled in later.
 */
export const PAGE_DOC_NODES = [
  'blockquote',
  'bulletList',
  'callout',
  'codeBlock',
  'details',
  'detailsContent',
  'detailsSummary',
  'doc',
  'hardBreak',
  'heading',
  'horizontalRule',
  'image',
  'listItem',
  'mention',
  'orderedList',
  'pageMention',
  'paragraph',
  'table',
  'tableCell',
  'tableHeader',
  'tableRow',
  'taskItem',
  'taskList',
  'text',
] as const

/** Every mark `buildPageExtensions()` can produce, sorted. */
export const PAGE_DOC_MARKS = ['bold', 'code', 'highlight', 'italic', 'link', 'strike', 'underline'] as const

export type PageDocNodeType = (typeof PAGE_DOC_NODES)[number]
export type PageDocMarkType = (typeof PAGE_DOC_MARKS)[number]

/** Heading levels a page body may use. */
export const PAGE_HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const

export interface PageDocMark {
  type: string
  attrs?: Record<string, unknown> | null
}

/**
 * One node of a stored page.
 *
 * Everything is optional because this describes JSON that arrived from somewhere — a database
 * column, an event payload, an import — rather than something built here. A renderer that assumes
 * `content` is an array is a renderer that throws on the first leaf node it meets.
 */
export interface PageDocNode {
  type?: string
  text?: string
  attrs?: Record<string, unknown> | null
  content?: PageDocNode[] | null
  marks?: PageDocMark[] | null
}

/** A whole page body. `type` is always `doc`. */
export interface PageDoc extends PageDocNode {
  type?: string
  content?: PageDocNode[] | null
}
