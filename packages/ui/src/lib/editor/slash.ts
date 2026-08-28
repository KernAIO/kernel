import type { Editor, Range } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import Suggestion, { type SuggestionOptions, type SuggestionProps } from '@tiptap/suggestion'
import { t } from '../i18n.svelte.js'
// side-effecting: register both bundles before the first label is asked for
import '../common-messages.js'
import './messages.js'
import { CALLOUT_TONES } from './nodes/callout.js'
import type { DiagramOptions } from './nodes/diagram.js'
import { STATUS_TONES } from './nodes/macros.js'
import { PAGE_HEADING_LEVELS } from './page-doc.js'

/**
 * `/` — the only way a person can reach most of the page schema.
 *
 * Tables, callouts and toggles were in the schema and in the renderer and could not be typed: no
 * toolbar, no bubble menu, no slash menu. A block set nobody can insert is a schema, not a feature.
 *
 * Built on the same suggestion mechanism the `@` and `+` menus use, and for the same reason —
 * Tiptap's suggestion API is imperative and wants a DOM node to own, so these handlers only push
 * state outwards and the menu is drawn in Svelte with the tokens, RTL and dark mode every other
 * menu in the product has.
 *
 * This extension contributes **no nodes and no marks**. That matters: `page-schema.test.ts` checks
 * that the schema is identical whatever options are passed, so a way to insert a block must never
 * be a way to change what a document can hold.
 */

export interface SlashItem {
  id: string
  /** Already translated — the list is rebuilt per query, so `t()` is called at the right moment. */
  label: string
  /** The heading a menu draws above this item. */
  group: string
  icon: string
  /** Extra words the query matches on, so "bullet" finds the bulleted list. */
  keywords: string[]
  /** Runs against a chain that has already deleted the `/query` the person typed. */
  run: (editor: Editor) => void
}

export interface SlashSuggestionState {
  open: boolean
  items: SlashItem[]
  rect: DOMRect | null
  command: ((item: SlashItem) => void) | null
}

export interface SlashOptions {
  /**
   * Supply to make the Image entry reachable. It opens the host's own picker — this package has no
   * upload surface, and an image node with no `fileId` renders as a gap on both sides of the wire.
   */
  pickImage?: () => Promise<{ fileId: string; alt?: string } | null>
  /**
   * Supply to make the two macros that name another page reachable — include page, excerpt include.
   * Opens the host's own page picker, for the same reason `pickImage` does: this package cannot
   * search pages, and a macro with no page id draws an empty frame on both sides of the wire.
   */
  pickPage?: () => Promise<{ pageId: string } | null>
  /**
   * Opens the host's diagram editor. Only the two notations this package cannot draw need it —
   * Excalidraw and Draw.io — so those two entries are hidden without it and Mermaid never is.
   */
  editDiagram?: DiagramOptions['editDiagram']
  /**
   * Asks the host for a URL and hands back the unfurl its server produced. Without it the Embed
   * entry is hidden: this package must not fetch a URL, so an embed inserted here with nothing
   * behind it would be a card with an address on it and nothing else.
   */
  pickEmbed?: () => Promise<{
    url: string
    title?: string | null
    description?: string | null
    siteName?: string | null
  } | null>
  /** Opens the host's object picker. Without it there is no way to name one, so the entry is hidden. */
  pickObject?: () => Promise<{ ref: string } | null>
  /** Whether `+` page mentions are wired up; the entry that types one is hidden when they are not. */
  pageMentions?: boolean
}

/**
 * What a Mermaid entry inserts.
 *
 * A starter rather than an empty block, and it matters: an empty Mermaid source draws as "there is
 * nothing here", so the first thing a writer would see after choosing the menu entry is a failure.
 * Two nodes and an arrow is the smallest thing that draws, and it shows the syntax by being it.
 */
const MERMAID_STARTER = 'flowchart TD\n  A[Start] --> B[Finish]'

/**
 * Nodes in `PAGE_DOC_NODES` that no slash item inserts, and why.
 *
 * Written down rather than left to be noticed, because `slash.test.ts` checks the list against the
 * schema: adding a node to the page format and forgetting to give people a way to type it is
 * exactly the mistake this file exists to correct, and it should not be repeatable.
 */
export const SLASH_STRUCTURAL_NODES = [
  // The document itself and its leaves.
  'doc',
  'text',
  // Typed with Enter and Shift-Enter, not from a menu.
  'hardBreak',
  // Only ever exist inside the block that owns them.
  'listItem',
  'taskItem',
  'tableRow',
  'tableCell',
  'tableHeader',
  'detailsSummary',
  'detailsContent',
] as const

/** Every node a slash item can put in the document, derived from the items themselves. */
export function slashInsertableNodes(options: SlashOptions = {}): string[] {
  return [...new Set(slashItems(options).flatMap((item) => item.id.split(':')[0] ?? []))]
}

const HEADING_ICONS: Record<number, string> = {
  1: 'heading-1',
  2: 'heading-2',
  3: 'heading-3',
  4: 'heading-4',
  5: 'heading-5',
  6: 'heading-6',
}

const CALLOUT_ICONS: Record<string, string> = {
  info: 'info',
  note: 'sticky-note',
  success: 'circle-check',
  warning: 'circle-alert',
  danger: 'triangle-alert',
}

/** One icon per lozenge colour, so the menu reads as five states rather than five identical rows. */
const STATUS_ICONS: Record<string, string> = {
  neutral: 'circle-dashed',
  info: 'circle-dot',
  success: 'circle-check',
  warning: 'circle-alert',
  danger: 'circle-x',
}

/**
 * The whole list, translated, in the order it is offered.
 *
 * Rebuilt on every keystroke rather than held in a module constant: the labels are what the query
 * matches against, and a list built once would be matched in whatever language the page loaded in.
 */
export function slashItems(options: SlashOptions = {}): SlashItem[] {
  const basic = t('editor.group_basic')
  const lists = t('editor.group_lists')
  const blocks = t('editor.group_blocks')
  const inserts = t('editor.group_insert')
  const macros = t('editor.group_macros')

  const items: SlashItem[] = [
    {
      id: 'paragraph',
      label: t('editor.block_text'),
      group: basic,
      icon: 'pilcrow',
      keywords: ['paragraph', 'plain', 'body'],
      run: (e) => e.chain().focus().setParagraph().run(),
    },
    ...PAGE_HEADING_LEVELS.map((level) => ({
      id: `heading:${level}`,
      label: t('editor.block_heading', { level }),
      group: basic,
      icon: HEADING_ICONS[level] ?? 'heading-2',
      keywords: ['heading', 'title', `h${level}`],
      run: (e: Editor) => e.chain().focus().setNode('heading', { level }).run(),
    })),
    {
      id: 'bulletList',
      label: t('editor.block_bullet_list'),
      group: lists,
      icon: 'list',
      keywords: ['bullet', 'unordered', 'ul'],
      run: (e) => e.chain().focus().toggleBulletList().run(),
    },
    {
      id: 'orderedList',
      label: t('editor.block_ordered_list'),
      group: lists,
      icon: 'list-ordered',
      keywords: ['numbered', 'ordered', 'ol'],
      run: (e) => e.chain().focus().toggleOrderedList().run(),
    },
    {
      id: 'taskList',
      label: t('editor.block_task_list'),
      group: lists,
      icon: 'list-checks',
      keywords: ['todo', 'task', 'checkbox', 'checklist'],
      run: (e) => e.chain().focus().toggleTaskList().run(),
    },
    {
      id: 'blockquote',
      label: t('editor.block_quote'),
      group: blocks,
      icon: 'quote',
      keywords: ['quote', 'citation'],
      run: (e) => e.chain().focus().toggleBlockquote().run(),
    },
    {
      id: 'codeBlock',
      label: t('editor.block_code'),
      group: blocks,
      icon: 'square-code',
      keywords: ['code', 'snippet', 'pre'],
      run: (e) => e.chain().focus().toggleCodeBlock().run(),
    },
    {
      id: 'table',
      label: t('editor.block_table'),
      group: blocks,
      icon: 'table',
      keywords: ['table', 'grid', 'rows', 'columns'],
      run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      id: 'details',
      label: t('editor.block_toggle'),
      group: blocks,
      icon: 'list-collapse',
      keywords: ['toggle', 'details', 'collapse', 'accordion'],
      run: (e) => e.chain().focus().setDetails().run(),
    },
    {
      id: 'horizontalRule',
      label: t('editor.block_divider'),
      group: blocks,
      icon: 'minus',
      keywords: ['divider', 'rule', 'separator', 'hr'],
      run: (e) => e.chain().focus().setHorizontalRule().run(),
    },
    ...CALLOUT_TONES.map((tone) => ({
      id: `callout:${tone}`,
      label: t(`editor.callout_${tone}`),
      group: blocks,
      icon: CALLOUT_ICONS[tone] ?? 'info',
      keywords: ['callout', 'panel', 'aside', 'admonition', tone],
      run: (e: Editor) => e.chain().focus().setCallout(tone).run(),
    })),
    {
      id: 'mention',
      // `common.mention` already says this in all five languages; one phrase, one translation.
      label: t('common.mention'),
      group: inserts,
      icon: 'at-sign',
      keywords: ['mention', 'person', 'people', 'user'],
      run: (e) => e.chain().focus().insertContent('@').run(),
    },

    /*
     * A Mermaid diagram, offered unconditionally — it is the one notation this package can both
     * draw and re-read, so it needs nothing from the host at all. The other two kinds are added
     * below, beside the entries that need a picker, because they do.
     */
    {
      id: 'diagram:mermaid',
      label: t('editor.diagram_mermaid'),
      group: blocks,
      icon: 'git-branch',
      keywords: ['diagram', 'mermaid', 'flowchart', 'sequence', 'graph', 'chart'],
      run: (e) => e.chain().focus().setDiagram({ kind: 'mermaid', source: MERMAID_STARTER }).run(),
    },

    /*
     * The macros. Six of the eight are here unconditionally; the two that name another page are
     * added below, because they need a picker only the host can open.
     *
     * `expand` sits beside the toggle deliberately and its keywords say so — somebody typing
     * "collapse" should be offered both and see which is which from the label, rather than find one
     * of them and never learn the other exists.
     */
    {
      id: 'pageChildren',
      label: t('editor.macro_children'),
      group: macros,
      icon: 'list-tree',
      keywords: ['children', 'child', 'pages', 'index', 'contents', 'subpages'],
      run: (e) => e.chain().focus().setPageChildren({ pageId: null, depth: 1 }).run(),
    },
    {
      id: 'excerpt',
      label: t('editor.macro_excerpt'),
      group: macros,
      icon: 'text-quote',
      keywords: ['excerpt', 'summary', 'extract', 'snippet'],
      run: (e) => e.chain().focus().setExcerpt().run(),
    },
    {
      id: 'recentlyUpdated',
      label: t('editor.macro_recently_updated'),
      group: macros,
      icon: 'history',
      keywords: ['recent', 'updated', 'changes', 'activity', 'latest'],
      run: (e) => e.chain().focus().setRecentlyUpdated({ scope: 'space', limit: 10 }).run(),
    },
    {
      id: 'contributors',
      label: t('editor.macro_contributors'),
      group: macros,
      icon: 'users',
      keywords: ['contributors', 'authors', 'people', 'byline', 'credits'],
      run: (e) => e.chain().focus().setContributors({ limit: 10 }).run(),
    },
    {
      id: 'expand',
      label: t('editor.macro_expand'),
      group: macros,
      icon: 'chevrons-up-down',
      keywords: ['expand', 'section', 'collapse', 'accordion', 'details'],
      run: (e) => e.chain().focus().setExpand().run(),
    },
    ...STATUS_TONES.map((tone) => ({
      id: `statusLozenge:${tone}`,
      label: t(`editor.status_${tone}`),
      group: macros,
      icon: STATUS_ICONS[tone] ?? 'circle-dashed',
      keywords: ['status', 'lozenge', 'badge', 'label', 'state', tone],
      /*
       * The tone's own word as the starting label, so the lozenge says something the moment it is
       * inserted — and the text is ordinary editable content, so the first thing somebody types
       * replaces it.
       */
      run: (e: Editor) =>
        e
          .chain()
          .focus()
          .setStatusLozenge(tone, t(`editor.status_${tone}`))
          .run(),
    })),
  ]

  if (options.pageMentions) {
    items.push({
      id: 'pageMention',
      label: t('editor.insert_page_link'),
      group: inserts,
      icon: 'link',
      keywords: ['page', 'link', 'wiki'],
      run: (e) => e.chain().focus().insertContent('+').run(),
    })
  }

  /*
   * The two macros that repeat another page. Offered only where the host can open a picker, for the
   * same reason the Image entry is: inserting one with no page id makes an empty frame, and a menu
   * entry whose only outcome is an empty frame is worse than no entry.
   */
  const pickPage = options.pickPage
  if (pickPage) {
    items.push(
      {
        id: 'includePage',
        label: t('editor.macro_include_page'),
        group: macros,
        icon: 'file-input',
        keywords: ['include', 'embed', 'page', 'transclude', 'reuse'],
        run: (e) => {
          void pickPage().then((picked) => {
            if (!picked) return
            e.chain().focus().setIncludePage({ pageId: picked.pageId, showTitle: true }).run()
          })
        },
      },
      {
        id: 'excerptInclude',
        label: t('editor.macro_excerpt_include'),
        group: macros,
        icon: 'quote',
        keywords: ['excerpt', 'include', 'summary', 'reuse', 'extract'],
        run: (e) => {
          void pickPage().then((picked) => {
            if (!picked) return
            e.chain().focus().setExcerptInclude({ pageId: picked.pageId, showTitle: true }).run()
          })
        },
      },
    )
  }

  /*
   * The two notations that are editors rather than grammars. Offered only where the host can open
   * one, for the same reason the Image entry is: this package cannot draw an Excalidraw scene, so an
   * entry with nothing behind it inserts a block that will never become a picture.
   */
  const editDiagram = options.editDiagram
  if (editDiagram) {
    const insert = (kind: 'excalidraw' | 'drawio') => (e: Editor) => {
      void editDiagram({ kind, source: '', title: null, svgFileId: null, href: null }).then((made) => {
        if (!made) return
        e.chain()
          .focus()
          .setDiagram({ kind, ...made })
          .run()
      })
    }
    items.push(
      {
        id: 'diagram:excalidraw',
        label: t('editor.diagram_excalidraw'),
        group: blocks,
        icon: 'pencil',
        keywords: ['excalidraw', 'diagram', 'sketch', 'whiteboard', 'draw'],
        run: insert('excalidraw'),
      },
      {
        id: 'diagram:drawio',
        label: t('editor.diagram_drawio'),
        group: blocks,
        icon: 'diamond',
        keywords: ['drawio', 'diagrams', 'diagram', 'visio', 'flowchart'],
        run: insert('drawio'),
      },
    )
  }

  /*
   * An embed of a public URL. The host asks its server to unfurl the address and hands back what
   * came off it, so this package never touches the network — see `pickEmbed`.
   */
  const pickEmbed = options.pickEmbed
  if (pickEmbed) {
    items.push({
      id: 'embed',
      label: t('editor.embed_link'),
      group: inserts,
      icon: 'globe',
      keywords: ['embed', 'link', 'url', 'bookmark', 'preview', 'unfurl'],
      run: (e) => {
        void pickEmbed().then((picked) => {
          if (!picked) return
          e.chain().focus().setEmbed(picked).run()
        })
      },
    })
  }

  /* One of Kern's own objects, by reference. Never unfurled — see the note on `ObjectEmbed`. */
  const pickObject = options.pickObject
  if (pickObject) {
    items.push({
      id: 'objectEmbed',
      label: t('editor.embed_object'),
      group: inserts,
      icon: 'puzzle',
      keywords: ['object', 'issue', 'link', 'card', 'reference', 'kern'],
      run: (e) => {
        void pickObject().then((picked) => {
          if (!picked) return
          e.chain().focus().setObjectEmbed({ ref: picked.ref }).run()
        })
      },
    })
  }

  const pickImage = options.pickImage
  if (pickImage) {
    items.push({
      id: 'image',
      label: t('editor.block_image'),
      group: inserts,
      icon: 'image',
      keywords: ['image', 'picture', 'photo', 'upload'],
      run: (e) => {
        void pickImage().then((picked) => {
          if (!picked) return
          e.chain()
            .focus()
            .setImage({ src: '', alt: picked.alt ?? '' })
            .updateAttributes('image', {
              fileId: picked.fileId,
            })
            .run()
        })
      },
    })
  }

  return items
}

/** Case- and accent-insensitive contains, so `/tabelle` and `/TABLE` both find the table. */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
}

export function filterSlashItems(query: string, options: SlashOptions = {}): SlashItem[] {
  const items = slashItems(options)
  const q = fold(query.trim())
  if (!q) return items
  return items.filter(
    (item) => fold(item.label).includes(q) || item.keywords.some((word) => fold(word).includes(q)),
  )
}

export interface SlashExtensionOptions extends SlashOptions {
  /** Called by the suggestion plugin so the host component can draw the menu in Svelte. */
  onSuggest?: (state: SlashSuggestionState) => void
  /** Consulted while the menu is open; return true to swallow the key. */
  onKey?: (event: KeyboardEvent) => boolean
}

export const SlashMenu = Extension.create<SlashExtensionOptions>({
  name: 'slashMenu',

  addOptions() {
    return {}
  },

  addProseMirrorPlugins() {
    const options = this.options
    const emit = (props: SuggestionProps<SlashItem>) =>
      options.onSuggest?.({
        open: true,
        items: props.items,
        rect: props.clientRect?.() ?? null,
        command: (item) => props.command(item as never),
      })

    const suggestion: SuggestionOptions<SlashItem> = {
      editor: this.editor,
      char: '/',
      /*
       * Only after a space or at the start of a block. Without it every URL in the document opens
       * the menu on its slashes, which is both useless and — because Enter then inserts a block —
       * destructive.
       */
      allowedPrefixes: [' '],
      /*
       * A code block is where a slash is most often a slash. `details` is excluded for a different
       * reason: its summary holds inline content only, so half the list would fail to insert.
       */
      allow: ({ state, range }) => {
        const $from = state.doc.resolve(range.from)
        for (let depth = $from.depth; depth > 0; depth--) {
          const name = $from.node(depth).type.name
          if (name === 'codeBlock' || name === 'detailsSummary') return false
        }
        return true
      },
      items: ({ query }) => filterSlashItems(query, options),
      command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashItem }) => {
        // Delete what was typed first, so every `run` starts from an empty block.
        editor.chain().focus().deleteRange(range).run()
        props.run(editor)
      },
      render: () => ({
        onStart: emit,
        onUpdate: emit,
        onKeyDown: ({ event }: { event: KeyboardEvent }) => options.onKey?.(event) ?? false,
        onExit: () => options.onSuggest?.({ open: false, items: [], rect: null, command: null }),
      }),
    }

    return [Suggestion(suggestion)]
  },
})
