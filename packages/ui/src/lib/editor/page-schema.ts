import { CodeBlock } from '@tiptap/extension-code-block'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { isChangeOrigin } from '@tiptap/extension-collaboration'
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details'
import { DragHandle } from '@tiptap/extension-drag-handle'
import { Highlight } from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import Mention from '@tiptap/extension-mention'
import { NodeRange } from '@tiptap/extension-node-range'
import { TableKit } from '@tiptap/extension-table'
import { getHierarchicalIndexes, TableOfContents } from '@tiptap/extension-table-of-contents'
import { UniqueID } from '@tiptap/extension-unique-id'
import { Placeholder } from '@tiptap/extensions'
import StarterKit from '@tiptap/starter-kit'
import type { SuggestionProps } from '@tiptap/suggestion'
import type { createLowlight } from 'lowlight'
import type { Doc as YDoc } from 'yjs'
import { Callout } from './nodes/callout.js'
import { Diagram, type DiagramOptions } from './nodes/diagram.js'
import { Embed, ObjectEmbed } from './nodes/embed.js'
import {
  Contributors,
  Excerpt,
  ExcerptInclude,
  Expand,
  IncludePage,
  PageChildren,
  RecentlyUpdated,
  StatusLozenge,
} from './nodes/macros.js'
import { PAGE_DOC_NODES, PAGE_HEADING_LEVELS } from './page-doc.js'
import type { MentionCandidate, SuggestionState } from './schema.js'
import { SlashMenu, type SlashSuggestionState } from './slash.js'

/**
 * The wiki page schema — a superset of the narrow one in `schema.ts`.
 *
 * Two schemas, deliberately. `buildExtensions` is what an issue description and a chat message
 * are written in, and it is small because everything that reads one of those has to be able to
 * draw all of it. A wiki page is a different document: it holds tables, panels, toggles and
 * pictures, and its reader is a page renderer that was written for exactly this list.
 *
 * `page-doc.ts` holds the list itself and explains why it is written down rather than derived.
 *
 * Two rules here are not stylistic, and both were mistakes worth naming.
 *
 * **Every schema-bearing extension is unconditional.** `buildExtensions` only adds `Mention` when
 * a `mentionSource` is passed, which makes the schema depend on an option — so a document written
 * on a surface that had mentions cannot be opened by a surface that did not, and the mentions
 * vanish. Configure the suggestion *source* conditionally; never the node.
 *
 * **`lowlight` must not change the schema.** `CodeBlockLowlight` and StarterKit's `codeBlock` are
 * the same node under the same name with the same `language` attribute; the highlighting is a
 * decoration plugin on top. So a caller who does not want ~100 KB of highlight.js gets the plain
 * node, and a document written with one opens perfectly in the other.
 */

/** What `createLowlight(common)` hands back. Typed structurally so nothing is imported at runtime. */
export type LowlightInstance = ReturnType<typeof createLowlight>

export interface PageCandidate {
  id: string
  label: string
  /** Shown beside the title in the menu, e.g. the space it lives in. */
  hint?: string | null
  icon?: string | null
}

export interface PageSchemaOptions {
  placeholder?: string
  /** Supply to enable `@` mentions of people. The node exists either way. */
  mentionSource?: (query: string) => MentionCandidate[] | Promise<MentionCandidate[]>
  /** Supply to enable `+` mentions of other pages. The node exists either way. */
  pageSource?: (query: string) => PageCandidate[] | Promise<PageCandidate[]>
  /** Called by the suggestion plugin so the host component can draw the menu in Svelte. */
  onSuggest?: (state: SuggestionState) => void
  onPageSuggest?: (state: PageSuggestionState) => void
  /**
   * Called by the `/` menu, which is the only way a person can reach most of this schema — tables,
   * callouts and toggles have no other entry point. The extension is installed either way, so the
   * document a surface without a menu produces is still the same document.
   */
  onSlashSuggest?: (state: SlashSuggestionState) => void
  /**
   * Supply to make the `/` menu's Image entry reachable. It opens the host's own file picker: this
   * package has no upload surface, and an image node without a `fileId` is a gap on both sides.
   */
  pickImage?: () => Promise<{ fileId: string; alt?: string } | null>
  /**
   * Supply to make the `/` menu's macro entries that name another page reachable — include page and
   * excerpt include. It opens the host's own page picker, exactly as `pickImage` opens its file
   * picker: this package cannot search pages, and a macro with no page id renders as an empty frame
   * on both sides.
   */
  pickPage?: () => Promise<{ pageId: string } | null>
  /**
   * The title of a page a macro names, for the editor's card only — never stored in the document.
   *
   * Resolved live by the host, in the writer's own session, through an API that has already checked
   * they may see the page. Without it a macro card says what it is without saying which page, which
   * is the honest fallback: a cached title outlives the permission that allowed it.
   */
  macroPageLabel?: (pageId: string) => string | null
  /**
   * Supply to make the `/` menu's Excalidraw and Draw.io entries reachable, and to give a writer a
   * way back into a diagram they have already inserted. It opens the host's own diagram editor, for
   * the same reason `pickImage` opens its file picker: this package has no upload surface and no
   * Excalidraw, and a diagram nobody can edit is a picture with a source attached to it.
   *
   * Mermaid needs none of this — it is a notation this package can both draw and re-read.
   */
  editDiagram?: DiagramOptions['editDiagram']
  /**
   * Supply to make the `/` menu's Embed entry reachable. It asks the host for a URL and hands back
   * the unfurl the server produced for it — this package must never fetch a URL a writer typed, and
   * on a page render nothing does: the answer is stored in the document once, here.
   */
  pickEmbed?: () => Promise<{
    url: string
    title?: string | null
    description?: string | null
    siteName?: string | null
  } | null>
  /**
   * Supply to make the `/` menu's "something from Kern" entry reachable. It opens the host's own
   * object picker and returns a `<module>:<type>:<id>` reference — never a title, which is resolved
   * against whoever is reading.
   */
  pickObject?: () => Promise<{ ref: string } | null>
  /**
   * What an embedded object is called, for the editor's card only — never stored in the document.
   * The same bargain `macroPageLabel` makes, and for the same reason.
   */
  objectLabel?: (ref: string) => string | null
  /** Consulted while either menu is open; return true to swallow the key. */
  onSuggestKey?: (event: KeyboardEvent) => boolean
  /** `createLowlight(common)`, when the caller is willing to pay for syntax highlighting. */
  lowlight?: LowlightInstance
  /** The collaborative document, when there is one. Only used to keep block ids stable. */
  document?: YDoc
  /**
   * The element to position as a drag handle. Required for one, because the handle has to be a
   * real element the host component owns — it needs the same tokens, RTL and focus styles as
   * everything else, and a handle built in raw DOM here would have none of them.
   */
  dragHandleElement?: HTMLElement
  /** Called whenever the heading outline changes, for a table-of-contents panel. */
  onOutline?: (entries: PageOutlineEntry[]) => void
}

export interface PageSuggestionState {
  open: boolean
  items: PageCandidate[]
  rect: DOMRect | null
  command: ((item: PageCandidate) => void) | null
}

export interface PageOutlineEntry {
  id: string
  textContent: string
  level: number
  isActive: boolean
  isScrolledOver: boolean
}

/**
 * Blocks that carry a stable `id`.
 *
 * Every top-level block rather than only headings: a heading id is what a table of contents links
 * to, but a comment anchor, a deep link and a drag handle all want to name a block that is not a
 * heading. `doc` and `text` cannot carry attributes, and the inline leaves have nothing to link to.
 */
const ID_TYPES = PAGE_DOC_NODES.filter(
  (name) =>
    !(['doc', 'text', 'hardBreak', 'mention', 'pageMention', 'statusLozenge'] as readonly string[]).includes(
      name,
    ),
) as unknown as string[]

/** Alignments a table cell may declare, closed so a document string never reaches a style attribute. */
export const TABLE_ALIGNMENTS = ['start', 'center', 'end'] as const
export type TableAlignment = (typeof TABLE_ALIGNMENTS)[number]

/**
 * A picture is stored by file id, not by URL.
 *
 * `core.files.downloadUrl` signs a URL with a lifetime measured in minutes. Storing one in the
 * document means a page silently loses its pictures weeks after it was written, and nothing in
 * the editor would ever show you that happening. The id is the identity; whoever renders the page
 * resolves it at the moment of rendering, for the audience the render is for.
 */
const PageImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fileId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-file-id'),
        renderHTML: (attributes) => (attributes.fileId ? { 'data-file-id': String(attributes.fileId) } : {}),
      },
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute('width'),
        renderHTML: (attributes) => (attributes.width ? { width: String(attributes.width) } : {}),
      },
      height: {
        default: null,
        parseHTML: (element) => element.getAttribute('height'),
        renderHTML: (attributes) => (attributes.height ? { height: String(attributes.height) } : {}),
      },
    }
  },
})

/**
 * A link to another page in the wiki.
 *
 * The same node machinery as a person mention, under its own name, because the two are different
 * things to everything downstream: one resolves to a profile and one to a page, one survives a
 * rename by id and the other has to re-read the page's title, and search treats them differently.
 */
const PageMention = Mention.extend({ name: 'pageMention' })

function suggestionRender<T>(
  push: (state: {
    open: boolean
    items: T[]
    rect: DOMRect | null
    command: ((item: T) => void) | null
  }) => void,
  onKey?: (event: KeyboardEvent) => boolean,
) {
  /*
   * Tiptap's suggestion API is imperative and wants a DOM node to own. These handlers only push
   * state outwards, so the menu is rendered in Svelte with the same tokens, RTL and dark mode as
   * every other menu in the product — the same arrangement `schema.ts` uses, for the same reason.
   */
  const emit = (p: SuggestionProps<T>) =>
    push({
      open: true,
      items: p.items,
      rect: p.clientRect?.() ?? null,
      command: (item) => p.command(item as never),
    })
  return () => ({
    onStart: emit,
    onUpdate: emit,
    onKeyDown: ({ event }: { event: KeyboardEvent }) => onKey?.(event) ?? false,
    onExit: () => push({ open: false, items: [], rect: null, command: null }),
  })
}

export function buildPageExtensions(options: PageSchemaOptions = {}) {
  const extensions: unknown[] = [
    StarterKit.configure({
      /*
       * All six levels. A page body that came from Markdown or Confluence is full of h1s, and
       * dropping them loses content rather than tidying it. The page title is still the document's
       * own h1 — see the note in prose.css about how a body h1 is sized down so the two do not
       * compete visually.
       */
      heading: { levels: [...PAGE_HEADING_LEVELS] },
      // Configured below with the protocol allow-list the renderer enforces.
      link: false,
      // Replaced below, so that supplying `lowlight` swaps the plugin and not the node.
      codeBlock: false,
      /*
       * Yjs owns history in a collaborative document, and StarterKit's stack is not merely
       * redundant there — the two race, and whichever plugin registered last wins the keystroke.
       * The caller cannot switch this on, because a page is always collaborative.
       */
      undoRedo: false,
      /*
       * StarterKit already carries `trailingNode`, and adding it again is not harmless: Tiptap
       * warns about the duplicate and runs both copies. Left at its default on purpose, so there
       * is always a paragraph to click below the last table or callout on the page.
       */
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      // Mirrors `safeHref` on the read side. A `javascript:` href is not a link a reader will ever
      // see, so it must not be one a writer can create.
      protocols: ['http', 'https', 'mailto'],
      HTMLAttributes: { rel: 'noreferrer noopener', target: '_blank' },
    }),
    Highlight.configure({ HTMLAttributes: { class: 'kern-highlight' } }),
    /*
     * The same node either way — `CodeBlockLowlight` extends `CodeBlock`, keeps its name and its
     * `language` attribute, and only adds a decoration plugin. A caller who does not want
     * highlight.js in their bundle gets a code block that is identical in the document.
     */
    options.lowlight ? CodeBlockLowlight.configure({ lowlight: options.lowlight }) : CodeBlock,
    TableKit.configure({
      table: { resizable: true, HTMLAttributes: { class: 'kern-table' } },
    }),
    PageImage.configure({ inline: false, allowBase64: false }),
    TaskList.configure({ HTMLAttributes: { class: 'kern-tasks' } }),
    TaskItem.configure({ nested: true }),
    Details.configure({ HTMLAttributes: { class: 'kern-toggle' }, persist: true }),
    DetailsSummary,
    DetailsContent,
    Callout,
    /*
     * The eight macros. Unconditional like everything else that carries a node: `pageLabel` only
     * changes what the editor's own card says about a macro, never what the document holds, so a
     * page written on a surface that resolves titles opens identically on one that does not.
     */
    PageChildren.configure({ pageLabel: options.macroPageLabel }),
    Excerpt,
    ExcerptInclude.configure({ pageLabel: options.macroPageLabel }),
    IncludePage.configure({ pageLabel: options.macroPageLabel }),
    RecentlyUpdated,
    Contributors,
    StatusLozenge,
    Expand,
    /*
     * Diagrams and embeds. Unconditional like everything else that carries a node: `editDiagram`,
     * `pickEmbed` and `objectLabel` change how a block is *reached* and what the writer's own card
     * says, never what the document can hold — so a page written on a surface that wires all three
     * opens identically on one that wires none.
     */
    Diagram.configure({ editDiagram: options.editDiagram }),
    Embed,
    ObjectEmbed.configure({ objectLabel: options.objectLabel }),
    Mention.configure({
      // The class the renderer emits, so a mention looks the same being written as being read.
      HTMLAttributes: { class: 'kern-mention' },
      suggestion: {
        char: '@',
        items: ({ query }: { query: string }) => options.mentionSource?.(query) ?? [],
        render: suggestionRender<MentionCandidate>(
          (state) => options.onSuggest?.(state as SuggestionState),
          options.onSuggestKey,
        ),
      },
    }),
    PageMention.configure({
      HTMLAttributes: { class: 'kern-page-mention' },
      suggestion: {
        // `+` rather than a second `@`: two menus on one key means guessing which one somebody
        // meant, and guessing wrong is worse than a key they have to learn once.
        char: '+',
        items: ({ query }: { query: string }) => options.pageSource?.(query) ?? [],
        render: suggestionRender<PageCandidate>(
          (state) => options.onPageSuggest?.(state),
          options.onSuggestKey,
        ),
      },
    }),
    UniqueID.configure({
      types: ID_TYPES,
      /*
       * Without this, every update arriving from another writer looks like a local change with
       * missing ids, so every client re-stamps every block and the document churns forever.
       */
      filterTransaction: (transaction) => !isChangeOrigin(transaction),
    }),
    TableOfContents.configure({
      getIndex: getHierarchicalIndexes,
      onUpdate: (content) => options.onOutline?.(content as unknown as PageOutlineEntry[]),
    }),
    Placeholder.configure({
      placeholder: options.placeholder ?? '',
      showOnlyWhenEditable: true,
    }),
    /*
     * Unconditional, like every other extension here — it carries no nodes and no marks, so a
     * surface that draws no menu still writes exactly the same document as one that does.
     */
    SlashMenu.configure({
      onSuggest: options.onSlashSuggest,
      onKey: options.onSuggestKey,
      pickImage: options.pickImage,
      pickPage: options.pickPage,
      editDiagram: options.editDiagram,
      pickEmbed: options.pickEmbed,
      pickObject: options.pickObject,
      // The `+` entry types a `+`, which is only useful where something answers it.
      pageMentions: Boolean(options.pageSource),
    }),
  ]

  /*
   * The drag handle only exists as a collaborative feature: it peer-depends on the collaboration
   * extensions, and it needs an element the host owns. Adding it unconditionally would make a
   * plain caller install a plugin whose peers may be unmet — which fails at install in every host
   * service, all of which set `strict-peer-dependencies`. It contributes no nodes, so the schema
   * is the same with and without it.
   */
  if (options.document && options.dragHandleElement) {
    const element = options.dragHandleElement
    extensions.push(NodeRange, DragHandle.configure({ render: () => element }))
  }

  return extensions as never[]
}

export { CALLOUT_TONES, type CalloutTone, calloutTone } from './nodes/callout.js'
export { diagramFileId, diagramKind, diagramSource, diagramTitle } from './nodes/diagram.js'
export {
  embedDescription,
  embedSite,
  embedTitle,
  embedUrl,
  objectRef,
  objectRefType,
} from './nodes/embed.js'
export {
  CHILDREN_SORTS,
  type ChildrenSort,
  childrenSort,
  DEFAULT_CHILDREN_SORT,
  DEFAULT_RECENT_SCOPE,
  DEFAULT_STATUS_TONE,
  MAX_CHILDREN_DEPTH,
  MAX_MACRO_ROWS,
  MAX_STATUS_LABEL,
  macroCount,
  macroFlag,
  macroPageId,
  RECENT_SCOPES,
  type RecentScope,
  recentScope,
  STATUS_TONES,
  type StatusTone,
  statusTone,
} from './nodes/macros.js'
export {
  DEFAULT_PAGE_DIAGRAM_KIND,
  PAGE_DIAGRAM_KINDS,
  PAGE_DIAGRAM_MAX_SOURCE,
  PAGE_DIAGRAM_MAX_TITLE,
  PAGE_DOC_MARKS,
  PAGE_DOC_NODES,
  PAGE_DOC_READING_MACROS,
  PAGE_EMBED_MAX_DESCRIPTION,
  PAGE_EMBED_MAX_SITE,
  PAGE_EMBED_MAX_TITLE,
  PAGE_EMBED_MAX_URL,
  PAGE_HEADING_LEVELS,
  PAGE_OBJECT_REF,
  type PageDiagramKind,
  type PageDoc,
  type PageDocMark,
  type PageDocMarkType,
  type PageDocNode,
  type PageDocNodeType,
  type PageDocReadingMacro,
} from './page-doc.js'
export {
  filterSlashItems,
  SLASH_STRUCTURAL_NODES,
  type SlashItem,
  type SlashOptions,
  type SlashSuggestionState,
  slashInsertableNodes,
  slashItems,
} from './slash.js'
