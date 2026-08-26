<script lang="ts">
import { Editor } from '@tiptap/core'
import { onDestroy, onMount } from 'svelte'
import Avatar from '../components/Avatar.svelte'
import { t } from '../i18n.svelte.js'
import Icon from '../icons/Icon.svelte'
import {
  type CollabPeer,
  type CollabStatus,
  type CollabUser,
  caretColour,
  createCollabSession,
} from './collab.js'
import { CommentAnchors, type CommentRange, selectionToAnchor } from './comment-anchors.js'
import {
  buildPageExtensions,
  type PageCandidate,
  type PageOutlineEntry,
  type PageSuggestionState,
} from './page-schema.js'
import SuggestionMenu, { type SuggestionMenuItem } from './SuggestionMenu.svelte'
import { buildExtensions, type MentionCandidate, type SuggestionState } from './schema.js'
import type { SlashItem, SlashSuggestionState } from './slash.js'

/**
 * A document several people write at the same time.
 *
 * The surface wears `.kern-prose`, the same class the read side wears, so nothing jumps between
 * writing and reading. Everything else here is about the parts of multiplayer that are invisible
 * when they work and obvious when they do not: whose undo is whose, what the connection is doing,
 * and who else is in the document.
 *
 * The editor is created once and never recreated from props. Rebuilding it would discard the Yjs
 * binding and re-sync from scratch, which reads as the document flickering every time anything
 * upstream changes.
 */

interface Props {
  /** WebSocket endpoint of the collab service. */
  url: string
  /** `ws:<workspaceId>:quire:page:<id>` — build it with `formatCollabDocument`. */
  name: string
  user: Omit<CollabUser, 'colour'> & { colour?: string }
  token?: string
  placeholder?: string
  /** Enables `@` mentions when supplied. */
  mentionSource?: (query: string) => MentionCandidate[] | Promise<MentionCandidate[]>
  /**
   * Write in the wide wiki schema — tables, images, task lists, callouts, toggles, highlighted
   * code, six heading levels and page mentions — instead of the narrow one.
   *
   * Opt-in, so every surface that already uses this component keeps exactly the schema it had. It
   * is not a display option: it decides what the document can contain, and only a reader that can
   * draw all of it should ask for it. `renderPageDoc` in @kernhq/module-quire is that reader.
   */
  page?: boolean
  /** Enables `+` mentions of other pages. Only meaningful with `page`. */
  pageSource?: (query: string) => PageCandidate[] | Promise<PageCandidate[]>
  /**
   * Opens the host's file picker for the `/` menu's Image entry, and resolves with what was
   * chosen — or `null` if nothing was. Without it the entry is not offered, because this package
   * has no upload surface and a picture is stored by file id rather than by URL.
   */
  pickImage?: () => Promise<{ fileId: string; alt?: string } | null>
  /** The heading outline, as it changes. Only fires with `page`. */
  onOutline?: (entries: PageOutlineEntry[]) => void
  /** Peers, so a page header can draw them next to the title rather than only here. */
  onpeers?: (peers: CollabPeer[]) => void
  onstatus?: (status: CollabStatus) => void
  /** Comment anchors to highlight. Read on every redraw, so pass whatever is loaded. */
  commentRanges?: CommentRange[]
  /** Which thread is open, drawn differently from the rest. */
  activeComment?: string | null
  onCommentClick?: (id: string) => void
  /** Fired when somebody selects text and asks to comment on it. */
  oncomment?: (anchor: { from: string; to: string }, quotedText: string) => void
  class?: string
}

const {
  url,
  name,
  user,
  token,
  placeholder = '',
  mentionSource,
  page = false,
  pageSource,
  pickImage,
  onOutline,
  onpeers,
  onstatus,
  commentRanges = [],
  activeComment = null,
  onCommentClick,
  oncomment,
  class: className,
}: Props = $props()

let host = $state<HTMLDivElement>()
let editor = $state<Editor>()
let status = $state<CollabStatus>('connecting')
let peers = $state<CollabPeer[]>([])
let authError = $state<string | null>(null)
/** Bumped on every transaction, so the comment button knows whether anything is selected. */
let tick = $state(0)
let ydoc = $state<import('yjs').Doc | null>(null)
/** The grip the drag-handle extension positions. Only rendered, and only used, in `page` mode. */
let dragHandle = $state<HTMLDivElement>()

/*
 * The three suggestion menus — `/` for blocks, `@` for people, `+` for pages.
 *
 * One state rather than three: only one trigger can match at a time, so a second open menu would
 * be a bug rather than a case to handle. Each trigger maps its own candidates onto the same row
 * shape and hands over what to do when a row is picked.
 *
 * Without this the page schema was unreachable — every callout, table and toggle it can hold had
 * no way in, and even `@` and `+` opened nothing, because the component never passed the callbacks
 * `buildPageExtensions` was already asking for.
 */
type MenuKind = 'blocks' | 'people' | 'pages'
interface OpenMenu {
  kind: MenuKind
  label: string
  items: SuggestionMenuItem[]
  rect: DOMRect | null
  pick: (index: number) => void
}
let menu = $state<OpenMenu | null>(null)
let active = $state(0)

function closeMenu(kind: MenuKind) {
  if (menu?.kind === kind) menu = null
}

/** A fresh list means the row that was highlighted may not be there any more. */
function openMenu(next: OpenMenu) {
  if (menu?.kind !== next.kind || menu.items.length !== next.items.length) active = 0
  else active = Math.min(active, Math.max(0, next.items.length - 1))
  menu = next
}

function onBlockSuggest(state: SlashSuggestionState) {
  if (!state.open) return closeMenu('blocks')
  openMenu({
    kind: 'blocks',
    label: t('editor.menu_blocks'),
    items: state.items.map((item: SlashItem) => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
      group: item.group,
    })),
    rect: state.rect,
    pick: (i) => {
      const item = state.items[i]
      if (item) state.command?.(item)
    },
  })
}

function onPersonSuggest(state: SuggestionState) {
  if (!state.open) return closeMenu('people')
  openMenu({
    kind: 'people',
    label: t('editor.menu_people'),
    items: state.items.map((item) => ({
      id: item.id,
      label: item.label,
      avatar: { id: item.id, name: item.label, src: item.avatarUrl },
    })),
    rect: state.rect,
    pick: (i) => {
      const item = state.items[i]
      if (item) state.command?.(item)
    },
  })
}

function onPageSuggest(state: PageSuggestionState) {
  if (!state.open) return closeMenu('pages')
  openMenu({
    kind: 'pages',
    label: t('editor.menu_pages'),
    items: state.items.map((item) => ({
      id: item.id,
      label: item.label,
      hint: item.hint,
      icon: item.icon ?? 'file-text',
    })),
    rect: state.rect,
    pick: (i) => {
      const item = state.items[i]
      if (item) state.command?.(item)
    },
  })
}

/**
 * Returns true when the key belonged to the menu, so the document never sees it.
 *
 * Escape is deliberately absent: the suggestion plugin handles it itself and then calls `onExit`,
 * which is what closes this. Swallowing it here would leave the plugin believing it is still open.
 */
function onSuggestKey(event: KeyboardEvent): boolean {
  const open = menu
  if (!open || open.items.length === 0) return false
  if (event.key === 'ArrowDown') {
    active = (active + 1) % open.items.length
    return true
  }
  if (event.key === 'ArrowUp') {
    active = (active - 1 + open.items.length) % open.items.length
    return true
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    open.pick(active)
    return true
  }
  return false
}

const hasSelection = $derived.by(() => {
  void tick
  const sel = editor?.state.selection
  return Boolean(sel && sel.from !== sel.to)
})

function comment() {
  if (!editor) return
  const anchor = selectionToAnchor(editor.state as never)
  if (!anchor) return
  const { from, to } = editor.state.selection
  oncomment?.(anchor, editor.state.doc.textBetween(from, to, ' ').slice(0, 2000))
}

const editable = $derived(status !== 'readonly')

onMount(() => {
  let session: ReturnType<typeof createCollabSession> | undefined
  let torn = false

  /*
   * Nothing is created synchronously because the wide schema wants syntax highlighting, and the
   * grammars are worth about eighty kilobytes that a comment box must never download. So they are
   * fetched on demand and the editor is built after they land — which means the teardown has to
   * cope with unmounting during the gap.
   */
  void (async () => {
    const lowlight = page ? await import('./highlight.js').then((m) => m.createPageLowlight()) : undefined
    if (torn) return

    session = createCollabSession({
      url,
      name,
      token,
      user: { ...user, colour: user.colour ?? caretColour(user.id) },
      onStatus: (s) => {
        status = s
        onstatus?.(s)
      },
      onPeers: (p) => {
        peers = p
        onpeers?.(p)
      },
      onAuthFailed: (reason) => {
        authError = reason
        status = 'offline'
      },
    })
    if (torn) {
      session.destroy()
      return
    }

    ydoc = session.doc
    /*
     * Undo belongs to Yjs on both schemas, and both builders are told so rather than being
     * filtered afterwards. Filtering is what used to happen here — `name !== 'history'` — and it
     * never removed anything: v3 calls the extension `undoRedo`, and it lives *inside* StarterKit,
     * which is a single entry in this list. So the document ran two competing undo stacks, and
     * @tiptap/extension-collaboration only warns about that.
     */
    const schema = page
      ? buildPageExtensions({
          placeholder,
          mentionSource,
          pageSource,
          pickImage,
          lowlight,
          onOutline,
          onSuggest: onPersonSuggest,
          onPageSuggest,
          onSlashSuggest: onBlockSuggest,
          onSuggestKey,
          document: session.doc,
          dragHandleElement: dragHandle,
        })
      : buildExtensions({
          placeholder,
          mentionSource,
          collaborative: true,
          onSuggest: onPersonSuggest,
          onSuggestKey,
        })

    editor = new Editor({
      element: host,
      extensions: [
        ...schema,
        ...(session.extensions as never[]),
        CommentAnchors.configure({
          doc: session.doc,
          ranges: () => commentRanges,
          active: () => activeComment,
          onClick: (id: string) => onCommentClick?.(id),
        }),
      ],
      onTransaction: () => {
        tick += 1
      },
      editable: true,
      editorProps: { attributes: { class: 'kern-prose', role: 'textbox', 'aria-multiline': 'true' } },
    })
  })()

  return () => {
    torn = true
    editor?.destroy()
    session?.destroy()
  }
})

onDestroy(() => editor?.destroy())

/**
 * Read-only is decided by the gateway, which answers after the socket is already open, so the
 * editor starts editable and is locked once the answer arrives.
 */
$effect(() => {
  editor?.setEditable(editable)
})

const statusLabel: Record<CollabStatus, string> = {
  connecting: 'Connecting…',
  connected: '',
  reconnecting: 'Reconnecting — your changes are saved here and will sync',
  offline: 'Offline — your changes are saved here and will sync when you reconnect',
  readonly: 'You have read access to this page',
}
</script>

<!-- `position: relative` on this wrapper is what the drag handle is positioned against. -->
<div class="editor {className ?? ''}">
  {#if peers.length > 0}
    <div class="peers" aria-label="People in this document">
      {#each peers as peer (peer.id)}
        <span class="peer" style:--caret={peer.colour} class:reader={peer.readOnly} title={peer.name}>
          <Avatar id={peer.id} name={peer.name} src={peer.avatarUrl} size={24} />
        </span>
      {/each}
    </div>
  {/if}

  {#if authError}
    <p class="note danger" role="alert"><Icon name="triangle-alert" size={14} /> {authError}</p>
  {:else if statusLabel[status]}
    <p class="note" role="status">
      <Icon name={status === 'readonly' ? 'eye-off' : 'wifi-off'} size={14} />
      {statusLabel[status]}
    </p>
  {/if}

  {#if oncomment && hasSelection && editable}
    <!--
      A single control rather than a floating bubble menu: the bubble would need its own
      positioning, RTL handling and dismissal, and the one action it would carry is this one.
    -->
    <div class="selection-actions">
      <button type="button" onmousedown={(e) => e.preventDefault()} onclick={comment}>
        <Icon name="message-circle" size={14} />
        <span>Comment on selection</span>
      </button>
    </div>
  {/if}

  {#if page}
    <!--
      The grip the drag-handle plugin positions beside whichever block the pointer is over. It is
      `aria-hidden` and not a button on purpose: dragging is the only thing it does, there is no
      keyboard equivalent behind it yet, and a focusable control that does nothing on Enter is a
      worse answer for a screen reader than no control at all.

      The inline `visibility: hidden` is load-bearing and has to be inline — see the note beside
      `.drag-handle` in the stylesheet below.
    -->
    <div bind:this={dragHandle} class="drag-handle" style="visibility: hidden" aria-hidden="true">
      <Icon name="grip-vertical" size={16} />
    </div>
  {/if}

  <div bind:this={host} class="surface" class:locked={!editable}></div>

  {#if menu}
    <SuggestionMenu
      open
      items={menu.items}
      rect={menu.rect}
      {active}
      label={menu.label}
      onpick={(i) => menu?.pick(i)}
      onhover={(i) => (active = i)}
    />
  {/if}
</div>

<style>
.editor {
  position: relative;
}
.peers {
  display: flex;
  align-items: center;
  gap: 0;
  margin-block-end: 10px;
}
/*
 * The ring is the person's caret colour, so the avatar in the header and the cursor in the text
 * are recognisably the same person — which is the only thing that makes a caret label useful.
 */
.peer {
  display: inline-flex;
  border-radius: var(--kern-r-full);
  box-shadow: 0 0 0 2px var(--kern-surface), 0 0 0 3.5px var(--caret);
  margin-inline-end: 8px;
}
.peer.reader {
  box-shadow: 0 0 0 2px var(--kern-surface);
  opacity: 0.7;
}
.note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  font-size: 12.5px;
  color: var(--kern-ink-400);
}
.note.danger {
  color: var(--kern-danger);
}
.selection-actions {
  position: sticky;
  inset-block-start: 0;
  z-index: 1;
  display: flex;
  justify-content: flex-start;
  margin-block-end: 8px;
}
.selection-actions button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border-radius: var(--kern-r-lg);
  border: 1px solid var(--kern-border);
  background: var(--kern-surface-raised);
  color: var(--kern-ink-700);
  font-size: 12.5px;
  cursor: pointer;
  box-shadow: var(--kern-shadow-popover);
}
.selection-actions button:hover {
  background: var(--kern-surface-hover);
}
/*
 * Decorations, not marks. A comment is not part of the document, and a mark would put one person's
 * annotation into everybody's content and into every export.
 */
.surface :global(.kern-comment-mark) {
  background: var(--kern-warning-tint);
  border-block-end: 2px solid var(--kern-warning);
  cursor: pointer;
}
.surface :global(.kern-comment-mark.active) {
  background: var(--kern-accent-tint);
  border-block-end-color: var(--kern-accent);
}
/*
 * Positioned by floating-ui, so only the look belongs here — and *only* the look.
 *
 * Showing and hiding belongs to the plugin, which does it with an inline
 * `element.style.visibility` it sets to `hidden` when the pointer is not beside a block and clears
 * to the empty string to show the grip again. Two rules follow from that, and both were wrong
 * here: this stylesheet must never declare `visibility`, because clearing an inline declaration
 * falls through to the sheet and the grip would never come back; and the element has to be
 * *rendered* already hidden, because the plugin only takes it over when the editor is created —
 * which is after the highlighting grammars have been fetched, so the grip would otherwise sit in
 * the top-left corner of the editor for as long as that takes.
 *
 * What was here instead was `.drag-handle:not(.hide)` against `.drag-handle.hide`, on a class
 * nothing has ever added: `:not(.hide)` always matched, so the pair resolved to a permanently
 * visible grip and read as if it did the opposite.
 */
.drag-handle {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 24px;
  border-radius: var(--kern-r-sm);
  color: var(--kern-ink-400);
  cursor: grab;
  transition:
    background-color var(--kern-dur-fast) var(--kern-ease-out),
    color var(--kern-dur-fast) var(--kern-ease-out);
}
.drag-handle:hover {
  background: var(--kern-surface-hover);
  color: var(--kern-ink-700);
}
.drag-handle:active {
  cursor: grabbing;
}
.surface :global(.kern-prose) {
  outline: none;
  min-height: 220px;
}
.surface.locked {
  opacity: 0.85;
}
/* A caret needs a name attached or a second cursor is just a coloured line. */
.surface :global(.collaboration-carets__caret) {
  position: relative;
  border-inline-start: 1px solid;
  border-inline-end: 1px solid;
  margin-inline-start: -1px;
  margin-inline-end: -1px;
  word-break: normal;
  pointer-events: none;
}
.surface :global(.collaboration-carets__label) {
  position: absolute;
  inset-block-start: -1.4em;
  inset-inline-start: -1px;
  border-radius: 3px;
  border-end-start-radius: 0;
  padding: 1px 5px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  color: var(--kern-ink-inverse);
  user-select: none;
}
</style>
