<script lang="ts">
import { Editor } from '@tiptap/core'
import { onDestroy, onMount } from 'svelte'
import Icon from '../icons/Icon.svelte'
import { buildExtensions, type MentionCandidate, type SuggestionState } from './schema.js'

/**
 * The writing surface for every stored rich-text document: issue descriptions, comments, and
 * whatever the documents module ends up needing.
 *
 * Two decisions carry most of the quality here.
 *
 * The editable area wears `.kern-prose`, the same class the read side wears. A heading is the same
 * size while you type it as it is once you save, so nothing jumps on Save and there is no second
 * stylesheet to keep in sync.
 *
 * Every toolbar control cancels `mousedown` instead of handling `click`. A `contenteditable` loses
 * its selection the instant something else takes focus, so a toolbar built on `click` applies bold
 * to a collapsed cursor and looks broken exactly when a user first tries it. Cancelling `mousedown`
 * means focus never leaves the document and the selection is still there when the command runs.
 */

interface Props {
  /** Tiptap JSON. Two-way: the parent reads this back after an edit. */
  value?: unknown
  placeholder?: string
  /** Rows of visible text before the box grows. */
  minRows?: number
  autofocus?: boolean
  disabled?: boolean
  label?: string
  /** Enables `@` mentions when supplied. */
  mentionSource?: (query: string) => MentionCandidate[] | Promise<MentionCandidate[]>
  /** Fired on Cmd/Ctrl+Enter — the shortcut every composer in the product answers to. */
  onsubmit?: () => void
  onescape?: () => void
  onchange?: (doc: unknown) => void
  class?: string
  'data-testid'?: string
}

let {
  value = $bindable(),
  placeholder = '',
  minRows = 3,
  autofocus = false,
  disabled = false,
  label,
  mentionSource,
  onsubmit,
  onescape,
  onchange,
  class: className,
  'data-testid': testid,
}: Props = $props()

let host = $state<HTMLDivElement>()
let editor = $state<Editor>()
/** Bumped on every transaction so the toolbar's active states recompute. */
let tick = $state(0)
let focused = $state(false)

// ---- `@` menu ----------------------------------------------------------------------------
let mention = $state<SuggestionState>({ open: false, items: [], rect: null, command: null })
let mentionActive = $state(0)
let menuEl = $state<HTMLUListElement>()
let menuPos = $state({ top: 0, left: 0 })

/*
 * Place the menu against the caret, and flip it above when the caret is near the bottom of the
 * window — a composer usually sits at the bottom of a panel, so "always below" put the list
 * off-screen exactly where it is most used. Measured rather than estimated, because the list is
 * as tall as it has rows.
 */
$effect(() => {
  const rect = mention.rect
  const el = menuEl
  if (!mention.open || !rect || !el) return
  const h = el.offsetHeight
  const w = el.offsetWidth
  const below = rect.bottom + 4
  const above = rect.top - h - 4
  const top = below + h <= window.innerHeight - 8 || above < 8 ? below : above
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - w - 8)
  if (menuPos.top !== top || menuPos.left !== left) menuPos = { top, left }
})

function onSuggest(next: SuggestionState) {
  // A fresh list means the previously highlighted row may no longer exist.
  if (!next.open || next.items !== mention.items) mentionActive = 0
  mention = next
}

function pickMention(item: MentionCandidate) {
  mention.command?.(item)
}

/** Returns true when the key belonged to the menu, so the document never sees it. */
function onSuggestKey(event: KeyboardEvent): boolean {
  if (!mention.open || !mention.items.length) return false
  if (event.key === 'ArrowDown') {
    mentionActive = (mentionActive + 1) % mention.items.length
    return true
  }
  if (event.key === 'ArrowUp') {
    mentionActive = (mentionActive - 1 + mention.items.length) % mention.items.length
    return true
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    const item = mention.items[mentionActive]
    if (item) pickMention(item)
    return true
  }
  if (event.key === 'Escape') {
    mention = { open: false, items: [], rect: null, command: null }
    return true
  }
  return false
}

// ---- link popover -------------------------------------------------------------------------
let linkOpen = $state(false)
let linkValue = $state('')
let linkInput = $state<HTMLInputElement>()

function openLink() {
  if (!editor) return
  linkValue = (editor.getAttributes('link').href as string) ?? ''
  linkOpen = true
  // The field has to exist before it can take focus, and it is rendered by this same update.
  queueMicrotask(() => linkInput?.focus())
}

function applyLink() {
  if (!editor) return
  const href = linkValue.trim()
  const chain = editor.chain().focus().extendMarkRange('link')
  if (href) chain.setLink({ href }).run()
  else chain.unsetLink().run()
  linkOpen = false
}

function removeLink() {
  editor?.chain().focus().extendMarkRange('link').unsetLink().run()
  linkOpen = false
}

// ---- toolbar ------------------------------------------------------------------------------
interface Tool {
  icon: string
  title: string
  keys?: string
  run: () => void
  active?: () => boolean
  enabled?: () => boolean
}

const groups: Tool[][] = [
  [
    {
      icon: 'bold',
      title: 'Bold',
      keys: '⌘B',
      run: () => editor?.chain().focus().toggleBold().run(),
      active: () => !!editor?.isActive('bold'),
    },
    {
      icon: 'italic',
      title: 'Italic',
      keys: '⌘I',
      run: () => editor?.chain().focus().toggleItalic().run(),
      active: () => !!editor?.isActive('italic'),
    },
    {
      icon: 'strikethrough',
      title: 'Strikethrough',
      keys: '⌘⇧S',
      run: () => editor?.chain().focus().toggleStrike().run(),
      active: () => !!editor?.isActive('strike'),
    },
    {
      icon: 'code',
      title: 'Inline code',
      keys: '⌘E',
      run: () => editor?.chain().focus().toggleCode().run(),
      active: () => !!editor?.isActive('code'),
    },
  ],
  [
    {
      icon: 'heading-2',
      title: 'Heading',
      run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
      active: () => !!editor?.isActive('heading', { level: 2 }),
    },
    {
      icon: 'heading-3',
      title: 'Subheading',
      run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
      active: () => !!editor?.isActive('heading', { level: 3 }),
    },
  ],
  [
    {
      icon: 'list',
      title: 'Bulleted list',
      keys: '⌘⇧8',
      run: () => editor?.chain().focus().toggleBulletList().run(),
      active: () => !!editor?.isActive('bulletList'),
    },
    {
      icon: 'list-ordered',
      title: 'Numbered list',
      keys: '⌘⇧7',
      run: () => editor?.chain().focus().toggleOrderedList().run(),
      active: () => !!editor?.isActive('orderedList'),
    },
    {
      icon: 'quote',
      title: 'Quote',
      run: () => editor?.chain().focus().toggleBlockquote().run(),
      active: () => !!editor?.isActive('blockquote'),
    },
    {
      icon: 'square-code',
      title: 'Code block',
      run: () => editor?.chain().focus().toggleCodeBlock().run(),
      active: () => !!editor?.isActive('codeBlock'),
    },
  ],
  [
    { icon: 'link', title: 'Link', keys: '⌘K', run: openLink, active: () => !!editor?.isActive('link') },
    { icon: 'minus', title: 'Divider', run: () => editor?.chain().focus().setHorizontalRule().run() },
  ],
]

/*
 * Undo and redo are deliberately not on the toolbar, for two reasons.
 *
 * The one that matters: their disabled state needs `editor.can().undo()`, and `can()` runs a
 * dry-run transaction. Reading it from the template therefore fired `onTransaction`, which bumps
 * `tick`, which is a state write during a template expression — Svelte throws
 * `state_unsafe_mutation` for exactly that. Anything wired to `can()` has to be computed outside
 * the render pass, and no other control here needs it.
 *
 * The one you see: at fourteen controls the row wrapped to a second line in a ~420px panel,
 * holding nothing but those two, which reads as a mistake.
 *
 * History still works — StarterKit binds ⌘Z and ⌘⇧Z, and nobody hunts for an undo button inside a
 * comment box.
 */

// ---- lifecycle ----------------------------------------------------------------------------
onMount(() => {
  if (!host) return
  const instance = new Editor({
    element: host,
    extensions: buildExtensions({ placeholder, mentionSource, onSuggest, onSuggestKey }),
    content: (value as never) ?? undefined,
    editable: !disabled,
    autofocus,
    editorProps: {
      attributes: {
        class: 'kern-prose kern-editor-doc',
        // A contenteditable div has no implicit role, so without these it is a box a screen
        // reader announces as nothing at all — and no test can ask for it by what it is.
        role: 'textbox',
        'aria-multiline': 'true',
        ...(label ? { 'aria-label': label } : {}),
        ...(testid ? { 'data-testid': testid } : {}),
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          onsubmit?.()
          return true
        }
        if (event.key === 'Escape') {
          if (linkOpen) {
            linkOpen = false
            return true
          }
          onescape?.()
          return true
        }
        if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          openLink()
          return true
        }
        return false
      },
    },
    onTransaction: () => {
      tick += 1
    },
    onFocus: () => {
      focused = true
    },
    onBlur: () => {
      focused = false
    },
    onUpdate: ({ editor: e }) => {
      // `isEmpty` rather than a truthiness check: Tiptap represents an empty document as one empty
      // paragraph, which is a perfectly truthy object, and storing that means every issue with no
      // description holds a document instead of null.
      const next = e.isEmpty ? null : e.getJSON()
      value = next
      onchange?.(next)
    },
  })
  editor = instance
})

onDestroy(() => editor?.destroy())

// The parent may replace the document (cancel an edit, load a different issue). Only push it in
// when it genuinely differs, or every keystroke would round-trip through the parent and reset the
// cursor to the start of the document.
$effect(() => {
  const next = value
  const e = editor
  if (!e) return
  const current = e.isEmpty ? null : e.getJSON()
  if (JSON.stringify(current) !== JSON.stringify(next ?? null)) {
    e.commands.setContent((next as never) ?? '', { emitUpdate: false })
  }
})

$effect(() => {
  editor?.setEditable(!disabled)
})

const isActive = (t: Tool) => {
  void tick
  return t.active?.() ?? false
}
const isEnabled = (t: Tool) => {
  void tick
  return t.enabled?.() ?? true
}
</script>

<div class="kedit {className ?? ''}" class:focused class:disabled>
  <div class="tb" role="toolbar" aria-label={label ?? 'Formatting'}>
    {#each groups as group, gi (gi)}
      {#if gi > 0}<span class="sep" aria-hidden="true"></span>{/if}
      {#each group as tool (tool.icon)}
        <button
          type="button"
          class="tbb"
          class:on={isActive(tool)}
          title={tool.keys ? `${tool.title} · ${tool.keys}` : tool.title}
          aria-label={tool.title}
          aria-pressed={tool.active ? isActive(tool) : undefined}
          disabled={disabled || !isEnabled(tool)}
          onmousedown={(e) => {
            e.preventDefault()
            tool.run()
          }}
        >
          <Icon name={tool.icon} size={14} strokeWidth={1.9} />
        </button>
      {/each}
    {/each}
  </div>

  <div class="doc" style="--kedit-min-rows: {minRows}" bind:this={host}></div>

  {#if linkOpen}
    <div class="linkbar">
      <input
        bind:this={linkInput}
        bind:value={linkValue}
        type="url"
        inputmode="url"
        placeholder="https://"
        aria-label="Link address"
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            applyLink()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            linkOpen = false
            editor?.commands.focus()
          }
        }}
      />
      <button type="button" class="lb-act" onmousedown={(e) => { e.preventDefault(); applyLink() }}>Apply</button>
      {#if editor?.isActive('link')}
        <button type="button" class="lb-act ghost" aria-label="Remove link" onmousedown={(e) => { e.preventDefault(); removeLink() }}>
          <Icon name="link-2-off" size={13} strokeWidth={1.9} />
        </button>
      {/if}
    </div>
  {/if}

  {#if mention.open && mention.items.length && mention.rect}
    <!-- Fixed to the caret's own rect: the document scrolls inside its box, and a menu positioned
         against the box would drift away from the `@` the moment it did. -->
    <ul
      bind:this={menuEl}
      class="mmenu"
      role="listbox"
      aria-label="People"
      style="top: {menuPos.top}px; left: {menuPos.left}px"
    >
      {#each mention.items as item, i (item.id)}
        <li>
          <button
            type="button"
            class="mrow"
            class:on={i === mentionActive}
            role="option"
            aria-selected={i === mentionActive}
            onmousedown={(e) => {
              e.preventDefault()
              pickMention(item)
            }}
            onmouseenter={() => (mentionActive = i)}
          >
            {#if item.avatarUrl}
              <img class="mav" src={item.avatarUrl} alt="" />
            {:else}
              <span class="mav ph" aria-hidden="true">{item.label.slice(0, 1)}</span>
            {/if}
            <span class="mname">{item.label}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  /* One field, not a toolbar sitting on top of a box: the ring is on the wrapper, so focusing the
     document lights the whole control the way an Input does. */
  .kedit {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--kern-border);
    border-radius: var(--kern-r-lg);
    background: var(--kern-surface);
    transition:
      border-color var(--kern-dur-fast) var(--kern-ease-out),
      box-shadow var(--kern-dur-fast) var(--kern-ease-out);
  }
  .kedit.focused {
    border-color: var(--kern-accent);
    box-shadow: 0 0 0 3px var(--kern-ring);
  }
  .kedit.disabled {
    opacity: 0.6;
  }

  .tb {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 1px;
    padding: 4px 5px;
    border-bottom: 1px solid var(--kern-border-muted);
  }
  .sep {
    width: 1px;
    height: 15px;
    margin: 0 4px;
    background: var(--kern-border);
    flex: none;
  }
  .tbb {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border: 0;
    border-radius: var(--kern-r-md);
    background: transparent;
    color: var(--kern-ink-450);
    cursor: pointer;
    flex: none;
    transition:
      background-color var(--kern-dur-fast) var(--kern-ease-out),
      color var(--kern-dur-fast) var(--kern-ease-out);
  }
  .tbb:hover:not(:disabled) {
    background: var(--kern-surface-hover);
    color: var(--kern-ink-900);
  }
  .tbb.on {
    background: var(--kern-ink-900);
    color: var(--kern-ink-inverse);
  }
  .tbb:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .tbb:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--kern-ring);
  }

  .doc {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  /* The document is created by Tiptap, so its class cannot be scoped by the compiler. */
  .doc :global(.kern-editor-doc) {
    /* `minRows` lines of the container's own font size, so a 2-row composer and a 6-row description
       editor come from one component. */
    min-height: calc(var(--kedit-min-rows, 3) * 1.55em);
    max-height: 60vh;
    overflow-y: auto;
    padding: 9px 11px;
    outline: none;
  }
  /* Tiptap's Placeholder marks the first node; without `is-editor-empty` the hint would also show
     on an empty paragraph in the middle of a written document. */
  .doc :global(.kern-editor-doc p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    float: inline-start;
    height: 0;
    pointer-events: none;
    color: var(--kern-ink-250);
  }

  .linkbar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 7px;
    border-top: 1px solid var(--kern-border-muted);
    background: var(--kern-surface-hover);
    border-radius: 0 0 var(--kern-r-lg) var(--kern-r-lg);
  }
  .linkbar input {
    flex: 1;
    min-width: 0;
    height: 28px;
    padding: 0 9px;
    border: 1px solid var(--kern-border);
    border-radius: var(--kern-r-md);
    background: var(--kern-surface);
    color: var(--kern-ink-800);
    font-size: 13px;
    /* a URL is Latin and left-to-right even in a Persian interface */
    direction: ltr;
    text-align: left;
  }
  .linkbar input:focus-visible {
    outline: none;
    border-color: var(--kern-accent);
    box-shadow: 0 0 0 2px var(--kern-ring);
  }
  .lb-act {
    display: grid;
    place-items: center;
    height: 28px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--kern-r-md);
    background: var(--kern-ink-900);
    color: var(--kern-ink-inverse);
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    flex: none;
  }
  .lb-act.ghost {
    padding: 0 8px;
    background: transparent;
    color: var(--kern-ink-450);
  }
  .lb-act.ghost:hover {
    background: var(--kern-ghost-hover-dark);
    color: var(--kern-ink-900);
  }

  .mmenu {
    position: fixed;
    z-index: 60;
    min-width: 190px;
    max-width: 280px;
    max-height: 240px;
    overflow-y: auto;
    margin: 0;
    padding: 4px;
    list-style: none;
    border: 1px solid var(--kern-border);
    border-radius: var(--kern-r-lg);
    background: var(--kern-surface);
    box-shadow: var(--kern-shadow-popover);
  }
  .mrow {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 5px 8px;
    border: 0;
    border-radius: var(--kern-r-md);
    background: transparent;
    color: var(--kern-ink-800);
    font-size: 13px;
    text-align: start;
    cursor: pointer;
  }
  .mrow.on {
    background: var(--kern-surface-hover);
    color: var(--kern-ink-900);
  }
  .mav {
    width: 20px;
    height: 20px;
    border-radius: var(--kern-r-full);
    object-fit: cover;
    flex: none;
  }
  .mav.ph {
    display: grid;
    place-items: center;
    background: var(--kern-info-tint);
    color: var(--kern-accent);
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
  }
  .mname {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
