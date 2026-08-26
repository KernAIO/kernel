import Link from '@tiptap/extension-link'
import Mention from '@tiptap/extension-mention'
import { Placeholder } from '@tiptap/extensions'
import StarterKit from '@tiptap/starter-kit'
import type { SuggestionProps } from '@tiptap/suggestion'

/**
 * The schema is not "whatever Tiptap ships". It is exactly the set of nodes and marks the read
 * side knows how to draw, and nothing else.
 *
 * That constraint is the point. A node the editor can produce but the renderer cannot draw
 * disappears the moment the document is saved and read back — the writer sees their table, the
 * reader sees a gap, and nobody finds out until someone complains. So StarterKit is cut down to
 * the intersection rather than taken whole.
 *
 * Supported: paragraph, heading 2-4, bulletList, orderedList, listItem, blockquote, codeBlock,
 * hardBreak, horizontalRule, mention · bold, italic, strike, code, link.
 */

export interface MentionCandidate {
  id: string
  label: string
  avatarUrl?: string | null
}

/** What the component needs in order to draw the `@` menu itself. */
export interface SuggestionState {
  open: boolean
  items: MentionCandidate[]
  rect: DOMRect | null
  command: ((item: MentionCandidate) => void) | null
}

export interface SchemaOptions {
  placeholder?: string
  /** Supply to enable `@` mentions. Called on every keystroke after `@`. */
  mentionSource?: (query: string) => MentionCandidate[] | Promise<MentionCandidate[]>
  /** Called by the suggestion plugin so the host component can render the menu in Svelte. */
  onSuggest?: (state: SuggestionState) => void
  /** Consulted while the menu is open; return true to swallow the key. */
  onSuggestKey?: (event: KeyboardEvent) => boolean
  /**
   * Set when a Yjs binding will supply history.
   *
   * Undo cannot be left to both. Two stacks race, and the one that wins a keystroke is whichever
   * plugin registered last — which is how ⌘Z in a shared document undoes the wrong thing. There is
   * no way to filter StarterKit's undo out afterwards, because StarterKit is a single extension
   * from the outside, so the decision has to be made here.
   */
  collaborative?: boolean
}

export function buildExtensions(options: SchemaOptions = {}) {
  const extensions: unknown[] = [
    StarterKit.configure({
      // Heading starts at 2: a comment or a description sits inside a page that already owns its
      // h1, and letting a writer emit another one breaks the outline for a screen reader.
      heading: { levels: [2, 3, 4] },
      // Off because the renderer has no case for them — see the note above.
      link: false,
      underline: false,
      ...(options.collaborative ? { undoRedo: false as const } : {}),
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
    Placeholder.configure({
      placeholder: options.placeholder ?? '',
      showOnlyWhenEditable: true,
    }),
  ]

  const source = options.mentionSource
  if (source) {
    extensions.push(
      Mention.configure({
        // The class the renderer emits, so a mention looks the same being written as posted.
        HTMLAttributes: { class: 'kern-mention' },
        suggestion: {
          char: '@',
          items: ({ query }: { query: string }) => source(query),
          /*
           * Tiptap's suggestion API is imperative and wants a DOM node to own. Rather than build
           * the menu here in raw DOM — which would then need its own theming, RTL and dark mode —
           * these handlers only push state outwards, and the Svelte component renders the menu
           * with the same tokens as everything else.
           */
          render: () => {
            const push = (p: SuggestionProps<MentionCandidate>) =>
              options.onSuggest?.({
                open: true,
                items: p.items,
                rect: p.clientRect?.() ?? null,
                command: (item) => p.command(item),
              })
            return {
              onStart: push,
              onUpdate: push,
              onKeyDown: ({ event }: { event: KeyboardEvent }) => options.onSuggestKey?.(event) ?? false,
              onExit: () => {
                options.onSuggest?.({ open: false, items: [], rect: null, command: null })
              },
            }
          },
        },
      }),
    )
  }

  return extensions as never[]
}
