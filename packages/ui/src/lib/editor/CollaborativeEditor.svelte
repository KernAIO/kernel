<script lang="ts">
import { Editor } from '@tiptap/core'
import { onDestroy, onMount } from 'svelte'
import Avatar from '../components/Avatar.svelte'
import Icon from '../icons/Icon.svelte'
import {
  type CollabPeer,
  type CollabStatus,
  type CollabUser,
  caretColour,
  createCollabSession,
} from './collab.js'
import { CommentAnchors, type CommentRange, selectionToAnchor } from './comment-anchors.js'
import { buildExtensions, type MentionCandidate } from './schema.js'

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
  const session = createCollabSession({
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

  ydoc = session.doc
  editor = new Editor({
    element: host,
    extensions: [
      // History is Yjs' job here. Leaving StarterKit's undo in place gives the document two
      // competing undo stacks, and the one that wins is whichever plugin registered last.
      ...buildExtensions({ placeholder, mentionSource }).filter(
        (e) => (e as { name?: string })?.name !== 'history',
      ),
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

  return () => {
    editor?.destroy()
    session.destroy()
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

<div class={className}>
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

  <div bind:this={host} class="surface" class:locked={!editable}></div>
</div>

<style>
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
