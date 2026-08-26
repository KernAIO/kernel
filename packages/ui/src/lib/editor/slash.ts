import type { Editor, Range } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import Suggestion, { type SuggestionOptions, type SuggestionProps } from '@tiptap/suggestion'
import { t } from '../i18n.svelte.js'
// side-effecting: register both bundles before the first label is asked for
import '../common-messages.js'
import './messages.js'
import { CALLOUT_TONES } from './nodes/callout.js'
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
  /** Whether `+` page mentions are wired up; the entry that types one is hidden when they are not. */
  pageMentions?: boolean
}

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
