import { mergeAttributes, Node } from '@tiptap/core'
import { t } from '../../i18n.svelte.js'
import {
  PAGE_CHILDREN_SORTS,
  PAGE_MACRO_MAX_DEPTH,
  PAGE_MACRO_MAX_ROWS,
  PAGE_MACRO_MAX_STATUS_LABEL,
  PAGE_RECENT_SCOPES,
  PAGE_STATUS_TONES,
} from '../page-doc.js'

/**
 * The eight macros — the Confluence baseline, as nodes in the page schema.
 *
 * A macro is a block somebody drops into a page that draws something the page does not itself
 * contain: the pages under this one, an extract of another page, who has written here, a coloured
 * word standing for a state. They are ordinary ProseMirror nodes rather than a mechanism of their
 * own, because everything downstream of the editor already knows how to handle a node and knows
 * nothing about a "macro": `PAGE_DOC_NODES` lists them, `renderPageDoc` in @kernhq/module-quire
 * draws them, the Markdown writer writes them, and each of those has a test that fails when one is
 * added here and nowhere else.
 *
 * **Five of them read other pages, and this file cannot.** `pageChildren`, `excerptInclude`,
 * `includePage`, `recentlyUpdated` and `contributors` name pages and people that are not in the
 * document, and whether a given reader may be shown them is a question only the server can answer —
 * against that reader, at the moment of reading. So the *node* holds only the question (which page,
 * how deep, how many) and never the answer. Nothing here caches a title, and that is deliberate:
 * a title cached in the document is a title that outlives the permission that allowed it, travels
 * into every export and every published copy, and is drawn by a renderer that never asked anybody.
 *
 * The markup contract is the same arrangement `callout.ts` describes, and it is worth stating
 * exactly rather than leaving to be inferred:
 *
 *     <div class="kern-macro" data-macro="children" data-page="…" data-depth="2">…</div>
 *     <div class="kern-excerpt" data-macro="excerpt"> …block content… </div>
 *     <details class="kern-expand" data-macro="expand"><summary>…</summary><div>…</div></details>
 *     <span class="kern-status" data-status="warning">Blocked</span>
 *
 * `data-macro` carries the kind *and* identifies the node, so each `parseHTML` has one thing to
 * match on and pasted HTML cannot produce a macro by accident. `renderPageDoc` emits the same
 * attributes in the same order, and `.kern-prose .kern-macro` in prose.css dresses both sides.
 */

/* -------------------------------------------------------------------------------------------- */
/* The closed sets, and the narrowing every side applies                                          */
/* -------------------------------------------------------------------------------------------- */

/**
 * How a children list is ordered.
 *
 * Closed, like every other enum in this schema, because the value ends up in a `data-` attribute
 * and in an `ORDER BY` on the server. `position` is the order of the page tree — where somebody
 * dragged them — and is the default because that is the order the sidebar already shows.
 */
export const CHILDREN_SORTS = PAGE_CHILDREN_SORTS
export type ChildrenSort = (typeof CHILDREN_SORTS)[number]
export const DEFAULT_CHILDREN_SORT: ChildrenSort = 'position'

/** What a "recently updated" list is drawn from: the whole space, or one page's descendants. */
export const RECENT_SCOPES = PAGE_RECENT_SCOPES
export type RecentScope = (typeof RECENT_SCOPES)[number]
export const DEFAULT_RECENT_SCOPE: RecentScope = 'space'

/**
 * The lozenge colours.
 *
 * The same five words `CALLOUT_TONES` uses minus `note` plus `neutral`, and the swap is not
 * arbitrary: a callout is a box with a tint, so "note" is a sensible name for a colour, while a
 * status is a word standing for a state and the state people reach for first is *no state yet* —
 * grey. Each maps to a colour pair in prose.css, and `nodes/macros.test.ts` holds the two lists
 * together exactly as `callout.test.ts` does.
 */
export const STATUS_TONES = PAGE_STATUS_TONES
export type StatusTone = (typeof STATUS_TONES)[number]
export const DEFAULT_STATUS_TONE: StatusTone = 'neutral'

/** How far down a children macro may go, and how many rows a list macro may draw. */
export const MAX_CHILDREN_DEPTH = PAGE_MACRO_MAX_DEPTH
export const MAX_MACRO_ROWS = PAGE_MACRO_MAX_ROWS
export const MAX_STATUS_LABEL = PAGE_MACRO_MAX_STATUS_LABEL

/** Narrow an untrusted value to a sort. Exported so the renderer applies the identical rule. */
export const childrenSort = (value: unknown): ChildrenSort =>
  CHILDREN_SORTS.includes(value as ChildrenSort) ? (value as ChildrenSort) : DEFAULT_CHILDREN_SORT

export const recentScope = (value: unknown): RecentScope =>
  RECENT_SCOPES.includes(value as RecentScope) ? (value as RecentScope) : DEFAULT_RECENT_SCOPE

export const statusTone = (value: unknown): StatusTone =>
  STATUS_TONES.includes(value as StatusTone) ? (value as StatusTone) : DEFAULT_STATUS_TONE

/**
 * A page id out of a document, or null.
 *
 * The pattern rather than a bare string check: this value reaches a `WHERE id = $1::uuid`, and a
 * value that is not a uuid turns a macro nobody can see into a 500 on the page that holds it.
 * Null is a legal answer everywhere it is used and means "the page this macro is on".
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const macroPageId = (value: unknown): string | null =>
  typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : null

/** A whole number inside a range, or the fallback. Never the string that was in the document. */
export function macroCount(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) return fallback
  return n
}

/** A boolean attribute out of a document, where `"true"` is what an HTML attribute carries. */
export const macroFlag = (value: unknown): boolean => value === true || value === 'true'

/* -------------------------------------------------------------------------------------------- */
/* The nodes                                                                                      */
/* -------------------------------------------------------------------------------------------- */

/**
 * Everything an atom macro shares.
 *
 * All five are `atom` block leaves: they hold no content, so a person cannot type inside one and
 * the document cannot end up with prose that only exists inside a macro nobody can resolve.
 * `draggable` so the drag handle picks them up like any other block, and `selectable` so a click
 * selects the whole thing and Backspace removes it — an atom with neither is a block a keyboard
 * user cannot delete.
 */
const atomMacro = {
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
} as const

/**
 * A node view for an atom, so the writer sees a labelled card rather than an empty line.
 *
 * Plain DOM rather than a Svelte component: this runs inside ProseMirror's own lifecycle, it draws
 * one static element per node, and mounting a component per macro would buy nothing but a teardown
 * path to get wrong. The card is `contenteditable=false` so the caret skips it.
 *
 * **The card never shows the macro's answer.** It shows the *question* — "Children of this page,
 * 2 levels" — because the answer depends on who is reading, and the editor is not a reader. Where
 * a macro names another page, the host may supply `pageLabel` to resolve that one title live, in
 * the writer's own session, through an API that has already checked they may see it.
 */
function macroCard(icon: string, title: string, detail: string): { dom: HTMLElement } {
  const dom = document.createElement('div')
  dom.className = 'kern-macro kern-macro-card'
  dom.contentEditable = 'false'
  dom.setAttribute('data-macro-card', icon)
  const name = document.createElement('span')
  name.className = 'kern-macro-name'
  name.textContent = title
  dom.append(name)
  if (detail) {
    const hint = document.createElement('span')
    hint.className = 'kern-macro-detail'
    hint.textContent = detail
    dom.append(hint)
  }
  return { dom }
}

/**
 * What a card says about the page a macro names.
 *
 * **"No page chosen" and "a page I cannot name" are different sentences**, and printing the first
 * for the second is a lie the writer acts on: they see a macro that looks unfinished, point it
 * somewhere again, and the one that was already right is replaced. A host resolves titles from what
 * it happens to have loaded — the space in front of the writer, usually — so a macro pointing into
 * another space is the ordinary case for the middle answer rather than an edge one.
 */
const pageDetail = (id: string | null, named: string | null): string =>
  id ? (named ?? t('editor.macro_other_page')) : t('editor.macro_no_page')

export interface MacroNodeOptions {
  /**
   * The title of a page a macro names, for the editor's card only.
   *
   * Resolved live by the host — never stored in the document. Returning null (which is the default,
   * and what every host that has not wired this up does) leaves the card saying what the macro is
   * without saying which page, which is honest: this package cannot read a page and must not
   * pretend a cached title is current.
   */
  pageLabel?: (pageId: string) => string | null
}

/**
 * The pages under this one.
 *
 * `pageId` null means "the page this macro is on", which is what almost every use of it wants and
 * what keeps the macro working after the page is copied into a template or duplicated. A page id is
 * stored only when the writer deliberately pointed it somewhere else.
 */
export const PageChildren = Node.create<MacroNodeOptions>({
  name: 'pageChildren',
  ...atomMacro,

  addOptions() {
    return {}
  },

  addAttributes() {
    return {
      pageId: {
        default: null,
        parseHTML: (element) => macroPageId(element.getAttribute('data-page')),
        renderHTML: (attrs) => {
          const id = macroPageId(attrs.pageId)
          return id ? { 'data-page': id } : {}
        },
      },
      depth: {
        default: 1,
        parseHTML: (element) => macroCount(element.getAttribute('data-depth'), 1, MAX_CHILDREN_DEPTH, 1),
        renderHTML: (attrs) => ({
          'data-depth': String(macroCount(attrs.depth, 1, MAX_CHILDREN_DEPTH, 1)),
        }),
      },
      sort: {
        default: DEFAULT_CHILDREN_SORT,
        parseHTML: (element) => childrenSort(element.getAttribute('data-sort')),
        renderHTML: (attrs) => ({ 'data-sort': childrenSort(attrs.sort) }),
      },
      showExcerpt: {
        default: false,
        parseHTML: (element) => macroFlag(element.getAttribute('data-excerpt')),
        renderHTML: (attrs) => (macroFlag(attrs.showExcerpt) ? { 'data-excerpt': 'true' } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-macro="children"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ class: 'kern-macro', 'data-macro': 'children' }, HTMLAttributes)]
  },

  addNodeView() {
    return ({ node }) => {
      const id = macroPageId(node.attrs.pageId)
      const named = id ? (this.options.pageLabel?.(id) ?? null) : null
      const depth = macroCount(node.attrs.depth, 1, MAX_CHILDREN_DEPTH, 1)
      /*
       * Three cases, not two, and the third is why: a macro pointed at another page whose title
       * this session cannot resolve is not "this page". Collapsing the two said "Pages under this
       * one" on a card listing somewhere else entirely — the one sentence on the card, and wrong.
       */
      return macroCard(
        'list-tree',
        t('editor.macro_children'),
        named
          ? t('editor.macro_children_of', { page: named, depth })
          : id
            ? t('editor.macro_children_other', { depth })
            : t('editor.macro_children_here', { depth }),
      )
    }
  },

  addCommands() {
    return {
      setPageChildren:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    }
  },
})

/**
 * The part of *this* page that other pages may repeat.
 *
 * A container rather than a leaf, and that is the whole idea: the excerpt is prose the writer has
 * already written, marked so it can be lifted, not a second copy of it kept somewhere else. One
 * page, one excerpt — a second is ignored by the reader, because "the excerpt" would otherwise mean
 * whichever one the query happened to reach first.
 *
 * `hidden` draws it on the source page as ordinary prose that is not shown — Confluence's
 * "hide the excerpt here" — for a page whose whole job is to be a source of extracts.
 */
export const Excerpt = Node.create({
  name: 'excerpt',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      hidden: {
        default: false,
        parseHTML: (element) => macroFlag(element.getAttribute('data-hidden')),
        renderHTML: (attrs) => (macroFlag(attrs.hidden) ? { 'data-hidden': 'true' } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-macro="excerpt"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ class: 'kern-excerpt', 'data-macro': 'excerpt' }, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setExcerpt:
        () =>
        ({ commands }) =>
          commands.wrapIn(this.name),
      unsetExcerpt:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    }
  },
})

/** Another page's excerpt, here. */
export const ExcerptInclude = Node.create<MacroNodeOptions>({
  name: 'excerptInclude',
  ...atomMacro,

  addOptions() {
    return {}
  },

  addAttributes() {
    return {
      pageId: {
        default: null,
        parseHTML: (element) => macroPageId(element.getAttribute('data-page')),
        renderHTML: (attrs) => {
          const id = macroPageId(attrs.pageId)
          return id ? { 'data-page': id } : {}
        },
      },
      /** Whether the extract is introduced by a link to where it came from. */
      showTitle: {
        default: true,
        parseHTML: (element) => element.getAttribute('data-title') !== 'false',
        renderHTML: (attrs) => (attrs.showTitle === false ? { 'data-title': 'false' } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-macro="excerpt-include"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ class: 'kern-macro', 'data-macro': 'excerpt-include' }, HTMLAttributes)]
  },

  addNodeView() {
    return ({ node }) => {
      const id = macroPageId(node.attrs.pageId)
      const named = id ? (this.options.pageLabel?.(id) ?? null) : null
      return macroCard('quote', t('editor.macro_excerpt_include'), pageDetail(id, named))
    }
  },

  addCommands() {
    return {
      setExcerptInclude:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    }
  },
})

/**
 * Another page's whole body, here.
 *
 * The heaviest of the eight and the one with the sharpest edge: it repeats a page's prose, so it
 * repeats whatever that page is allowed to say to whoever is reading *this* one. The renderer draws
 * it from HTML the server produced for this reader and this reader only; there is no cache of it in
 * the document and no path by which one page's body reaches a reader through another page's macro
 * without being asked about first.
 */
export const IncludePage = Node.create<MacroNodeOptions>({
  name: 'includePage',
  ...atomMacro,

  addOptions() {
    return {}
  },

  addAttributes() {
    return {
      pageId: {
        default: null,
        parseHTML: (element) => macroPageId(element.getAttribute('data-page')),
        renderHTML: (attrs) => {
          const id = macroPageId(attrs.pageId)
          return id ? { 'data-page': id } : {}
        },
      },
      showTitle: {
        default: true,
        parseHTML: (element) => element.getAttribute('data-title') !== 'false',
        renderHTML: (attrs) => (attrs.showTitle === false ? { 'data-title': 'false' } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-macro="include-page"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ class: 'kern-macro', 'data-macro': 'include-page' }, HTMLAttributes)]
  },

  addNodeView() {
    return ({ node }) => {
      const id = macroPageId(node.attrs.pageId)
      const named = id ? (this.options.pageLabel?.(id) ?? null) : null
      return macroCard('file-input', t('editor.macro_include_page'), pageDetail(id, named))
    }
  },

  addCommands() {
    return {
      setIncludePage:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    }
  },
})

/** What has changed lately, in this space or under one page. */
export const RecentlyUpdated = Node.create<MacroNodeOptions>({
  name: 'recentlyUpdated',
  ...atomMacro,

  addOptions() {
    return {}
  },

  addAttributes() {
    return {
      scope: {
        default: DEFAULT_RECENT_SCOPE,
        parseHTML: (element) => recentScope(element.getAttribute('data-scope')),
        renderHTML: (attrs) => ({ 'data-scope': recentScope(attrs.scope) }),
      },
      pageId: {
        default: null,
        parseHTML: (element) => macroPageId(element.getAttribute('data-page')),
        renderHTML: (attrs) => {
          const id = macroPageId(attrs.pageId)
          return id ? { 'data-page': id } : {}
        },
      },
      limit: {
        default: 10,
        parseHTML: (element) => macroCount(element.getAttribute('data-limit'), 1, MAX_MACRO_ROWS, 10),
        renderHTML: (attrs) => ({ 'data-limit': String(macroCount(attrs.limit, 1, MAX_MACRO_ROWS, 10)) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-macro="recently-updated"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ class: 'kern-macro', 'data-macro': 'recently-updated' }, HTMLAttributes)]
  },

  addNodeView() {
    return ({ node }) =>
      macroCard(
        'history',
        t('editor.macro_recently_updated'),
        t('editor.macro_recent_detail', {
          count: macroCount(node.attrs.limit, 1, MAX_MACRO_ROWS, 10),
        }),
      )
  },

  addCommands() {
    return {
      setRecentlyUpdated:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    }
  },
})

/** Who has written on this page. Always this page: a byline for somebody else's is not a byline. */
export const Contributors = Node.create<MacroNodeOptions>({
  name: 'contributors',
  ...atomMacro,

  addOptions() {
    return {}
  },

  addAttributes() {
    return {
      limit: {
        default: 10,
        parseHTML: (element) => macroCount(element.getAttribute('data-limit'), 1, MAX_MACRO_ROWS, 10),
        renderHTML: (attrs) => ({ 'data-limit': String(macroCount(attrs.limit, 1, MAX_MACRO_ROWS, 10)) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-macro="contributors"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ class: 'kern-macro', 'data-macro': 'contributors' }, HTMLAttributes)]
  },

  addNodeView() {
    return () => macroCard('users', t('editor.macro_contributors'), t('editor.macro_contributors_detail'))
  },

  addCommands() {
    return {
      setContributors:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    }
  },
})

/**
 * A coloured word standing for a state — Draft, In review, Blocked, Done.
 *
 * The one inline macro, and the only one of the eight that resolves to nothing: it is a label and a
 * colour, both in the document. That is why it is safe on a public page without anybody being asked
 * anything, and why it is the macro people actually reach for a hundred times a week.
 *
 * The label is content rather than an attribute, so it is ordinary editable text: a lozenge whose
 * word can only be changed through a dialog is a lozenge nobody renames. `inline*` with no marks is
 * what keeps it a lozenge rather than a place to nest a table.
 */
export const StatusLozenge = Node.create({
  name: 'statusLozenge',
  group: 'inline',
  inline: true,
  content: 'text*',
  marks: '',
  selectable: true,
  /*
   * Without this the surrounding paragraph's marks bleed into the lozenge: typing a status inside a
   * bold sentence produced a bold lozenge, which reads as a different state.
   */
  code: false,

  addAttributes() {
    return {
      tone: {
        default: DEFAULT_STATUS_TONE,
        parseHTML: (element) => statusTone(element.getAttribute('data-status')),
        renderHTML: (attrs) => ({ 'data-status': statusTone(attrs.tone) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-status]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'kern-status' }, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setStatusLozenge:
        (tone: StatusTone = DEFAULT_STATUS_TONE, label = '') =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { tone: statusTone(tone) },
            content: label ? [{ type: 'text', text: label.slice(0, MAX_STATUS_LABEL) }] : [],
          }),
    }
  },
})

/**
 * A titled section a reader opens.
 *
 * `details` is next door in the schema and is the same HTML element, so it is worth saying why both
 * exist rather than leaving somebody to wonder. A **toggle** (`details`) is the Notion gesture: a
 * line of prose with everything under it folded away, and whether it is open is the reader's own
 * business — the extension persists that per reader and it is not in the document. An **expand**
 * (this one) is the Confluence macro: a labelled box whose open state is a decision the *writer*
 * made and stored, so a runbook can ship with its rollback steps already showing.
 *
 * They share `detailsSummary` and `detailsContent` rather than inventing two more node types, which
 * is what keeps a page written with one openable by somebody who reaches for the other.
 */
export const Expand = Node.create({
  name: 'expand',
  group: 'block',
  content: 'detailsSummary detailsContent',
  defining: true,

  addAttributes() {
    return {
      open: {
        default: false,
        parseHTML: (element) => element.hasAttribute('open'),
        renderHTML: (attrs) => (macroFlag(attrs.open) ? { open: 'open' } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'details[data-macro="expand"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes({ class: 'kern-expand', 'data-macro': 'expand' }, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setExpand:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: { open: true },
              content: [
                { type: 'detailsSummary' },
                { type: 'detailsContent', content: [{ type: 'paragraph' }] },
              ],
            })
            .run(),
    }
  },
})

/** Every macro node, in the order they are added to the schema. */
export const macroNodes = [
  PageChildren,
  Excerpt,
  ExcerptInclude,
  IncludePage,
  RecentlyUpdated,
  Contributors,
  StatusLozenge,
  Expand,
]

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    macros: {
      setPageChildren: (attrs?: Record<string, unknown>) => ReturnType
      setExcerpt: () => ReturnType
      unsetExcerpt: () => ReturnType
      setExcerptInclude: (attrs?: Record<string, unknown>) => ReturnType
      setIncludePage: (attrs?: Record<string, unknown>) => ReturnType
      setRecentlyUpdated: (attrs?: Record<string, unknown>) => ReturnType
      setContributors: (attrs?: Record<string, unknown>) => ReturnType
      setStatusLozenge: (tone?: StatusTone, label?: string) => ReturnType
      setExpand: () => ReturnType
    }
  }
}
