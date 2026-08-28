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
  'contributors',
  'details',
  'detailsContent',
  'detailsSummary',
  'doc',
  'excerpt',
  'excerptInclude',
  'expand',
  'hardBreak',
  'heading',
  'horizontalRule',
  'image',
  'includePage',
  'listItem',
  'mention',
  'orderedList',
  'pageChildren',
  'pageMention',
  'paragraph',
  'recentlyUpdated',
  'statusLozenge',
  'table',
  'tableCell',
  'tableHeader',
  'tableRow',
  'taskItem',
  'taskList',
  'text',
] as const

/**
 * The five nodes that draw something the document does not contain.
 *
 * Named here rather than inferred from a naming convention, because this is the list a renderer has
 * to treat as **fail-closed**: each one names other pages, and whether a given reader may be shown
 * them is a question only a server can answer, against that reader, at the moment of reading. A
 * renderer handed no answer for one of these draws its frame and nothing else — never a title, never
 * a link, never an extract. `statusLozenge`, `excerpt` and `expand` are not here: all three resolve
 * to what is already in the document, which is why they are safe on a page with no reader at all.
 *
 * `render.test.ts` in @kernhq/module-quire checks this list against the renderer's own, so a sixth
 * reading macro cannot be added without the renderer's fail-closed case being added with it.
 */
export const PAGE_DOC_READING_MACROS = [
  'contributors',
  'excerptInclude',
  'includePage',
  'pageChildren',
  'recentlyUpdated',
] as const
export type PageDocReadingMacro = (typeof PAGE_DOC_READING_MACROS)[number]

/**
 * The status lozenge's colours.
 *
 * Here rather than beside the node for the same reason `PAGE_DOC_NODES` is: the renderer in
 * @kernhq/module-quire has to narrow this exact set before the value reaches an attribute selector,
 * and it cannot import the node — that file loads Tiptap and Svelte, neither of which belongs in a
 * backend process. This one imports nothing and is safe to read from anywhere.
 */
export const PAGE_STATUS_TONES = ['neutral', 'info', 'success', 'warning', 'danger'] as const
export type PageStatusTone = (typeof PAGE_STATUS_TONES)[number]

/** How a children macro may be ordered, and how far down it and its siblings may reach. */
export const PAGE_CHILDREN_SORTS = ['position', 'title', 'updated'] as const
export type PageChildrenSort = (typeof PAGE_CHILDREN_SORTS)[number]

/** What a "recently updated" macro is drawn from: the whole space, or one page's descendants. */
export const PAGE_RECENT_SCOPES = ['space', 'subtree'] as const
export type PageRecentScope = (typeof PAGE_RECENT_SCOPES)[number]

/**
 * The ceilings a macro's attributes are clamped to, on both sides of the wire.
 *
 * A document decides how much work a request does, so these are not advisory: a `depth` of 900 in a
 * page somebody pasted in is a recursive query somebody pasted in.
 */
export const PAGE_MACRO_MAX_DEPTH = 5
export const PAGE_MACRO_MAX_ROWS = 25
/** The longest a lozenge may be. A label that wraps is not a lozenge; it is a sentence in a box. */
export const PAGE_MACRO_MAX_STATUS_LABEL = 40

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
