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
  'diagram',
  'doc',
  'embed',
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
  'objectEmbed',
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
 * The six nodes that draw something the document does not contain.
 *
 * Named here rather than inferred from a naming convention, because this is the list a renderer has
 * to treat as **fail-closed**: each one names something outside the document — another page, the
 * people who wrote here, an issue in another module — and whether a given reader may be shown it is
 * a question only a server can answer, against that reader, at the moment of reading. A renderer
 * handed no answer for one of these draws its frame and nothing else — never a title, never a link,
 * never an extract. `statusLozenge`, `excerpt` and `expand` are not here: all three resolve to what
 * is already in the document, which is why they are safe on a page with no reader at all.
 *
 * `embed` is deliberately not here either, and the difference is worth stating. An embed holds the
 * unfurl of a **public** URL, fetched once by the server when the writer inserted it and stored in
 * the document like any other prose they typed: there is no permission attached to it, so there is
 * nobody to ask and nothing to withhold. `objectEmbed` is the opposite — it names one of Kern's own
 * objects by reference and holds no title at all, precisely so that whether a reader may be told
 * what it is stays a question rather than becoming a cached answer.
 *
 * `render.test.ts` in @kernhq/module-quire checks this list against the renderer's own, so a seventh
 * reading macro cannot be added without the renderer's fail-closed case being added with it.
 */
export const PAGE_DOC_READING_MACROS = [
  'contributors',
  'excerptInclude',
  'includePage',
  'objectEmbed',
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

/**
 * The three kinds of diagram a page can hold, and what each one means on the read side.
 *
 * A diagram node stores its **source** — Mermaid text, an Excalidraw scene, a Draw.io document —
 * because the source is the thing somebody wrote and the only thing an editor can reopen. What the
 * three do not share is whether that source can be turned into a picture outside a browser:
 *
 *   - `mermaid` is text with a grammar, so `renderMermaid` next door draws it server-side, with no
 *     DOM, no headless browser and no network. That is a genuine render, and it is why Mermaid is
 *     the kind the `/` menu offers without the host having to supply anything.
 *   - `excalidraw` and `drawio` are editors, not notations: drawing one faithfully means running
 *     the editor. So the honest server-side answer is **the SVG the editor already exported, when
 *     the writer saved one, and a link when they did not** — never a blank block, and never a
 *     picture we pretended to draw. `svgFileId` is where that saved picture lives.
 *
 * Closed, like every other enum in this schema, because the value reaches a `data-` attribute and
 * an attribute selector on both sides of the wire.
 */
export const PAGE_DIAGRAM_KINDS = ['mermaid', 'excalidraw', 'drawio'] as const
export type PageDiagramKind = (typeof PAGE_DIAGRAM_KINDS)[number]
export const DEFAULT_PAGE_DIAGRAM_KIND: PageDiagramKind = 'mermaid'

/**
 * How much source one diagram may carry.
 *
 * An Excalidraw scene is JSON and grows with every stroke, so this is not a formality: a document is
 * synchronised on every keystroke through a CRDT, and an unbounded blob in one is a page that stops
 * loading. A source over the cap is stored truncated rather than rejected — see `diagramSource`.
 */
export const PAGE_DIAGRAM_MAX_SOURCE = 96_000

/** The longest a diagram's own name may be. It is a caption, not a paragraph. */
export const PAGE_DIAGRAM_MAX_TITLE = 200

/** What an unfurl may put in a document: a headline, a sentence, and who the site is. */
export const PAGE_EMBED_MAX_TITLE = 200
export const PAGE_EMBED_MAX_DESCRIPTION = 400
export const PAGE_EMBED_MAX_SITE = 80
/** A URL longer than this is not an address anybody typed. */
export const PAGE_EMBED_MAX_URL = 2048

/**
 * `<module>:<type>:<id>` — the same spelling `objectRefToString` in `@kernhq/contracts` produces.
 *
 * Restated as a pattern rather than imported for the reason this whole file exists: it is read by a
 * Node process with no Zod, no DOM and no reason to pull a contract package in. What it narrows is
 * the one attribute of `objectEmbed`, and narrowing it here is what stops a document string reaching
 * a resolver as three unvalidated segments.
 */
export const PAGE_OBJECT_REF = /^[a-z][a-z0-9_]{0,31}:[a-z][a-z0-9_-]{0,31}:[A-Za-z0-9_-]{1,64}$/

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
