<script module lang="ts">
/** One row. Each of the three triggers maps its own candidates onto this before handing them over. */
export interface SuggestionMenuItem {
  id: string
  label: string
  /** Drawn quietly after the label — a person's handle, a page's space. */
  hint?: string | null
  icon?: string | null
  avatar?: { id: string; name: string; src?: string | null } | null
  /** Items sharing a group are drawn under one heading, in the order they arrive. */
  group?: string | null
}
</script>

<script lang="ts">
/**
 * The list a suggestion trigger opens — `/` for blocks, `@` for people, `+` for pages.
 *
 * One component for all three, because they are the same object: a list anchored to the caret,
 * driven from the keyboard while focus stays in the document, dismissed by the plugin. Tiptap's
 * suggestion API would rather own a DOM node and build this itself; every menu built that way needs
 * its own theming, RTL and dark mode, and gets them wrong. So the plugin only pushes state outward
 * and this draws it, wearing `.kmenu` — the same popup surface every other menu in Kern wears, at
 * the same layer.
 *
 * Focus never moves here. The caret has to stay in the document or typing stops, so the rows are
 * `role="option"` inside a `role="listbox"`, the keys are handled by the editor's own key handler,
 * and a pointer press is cancelled with `preventDefault` before it can steal the selection.
 */
import Avatar from '../components/Avatar.svelte'
import Icon from '../icons/Icon.svelte'
import { t } from '../i18n.svelte.js'

interface Props {
  open: boolean
  items: SuggestionMenuItem[]
  /** The caret's rect, in viewport coordinates. */
  rect: DOMRect | null
  /** Index of the highlighted row; the parent owns it because the parent owns the keys. */
  active: number
  /** Names the list for a screen reader — "Blocks", "People", "Pages". */
  label: string
  onpick: (index: number) => void
  onhover: (index: number) => void
}

const { open, items, rect, active, label, onpick, onhover }: Props = $props()

let menuEl = $state<HTMLElement>()
let pos = $state({ top: 0, left: 0 })

/*
 * Placed against the caret and flipped above it when the caret is near the bottom of the window —
 * measured rather than estimated, because the list is as tall as it has rows. The clamp is in
 * viewport coordinates, so it holds in both directions without a special case for RTL.
 */
$effect(() => {
  const r = rect
  const el = menuEl
  // Read explicitly: the size is measured from the DOM, so nothing else here re-runs when the
  // list gets longer or shorter and the position would be measured from the previous list.
  void items.length
  if (!open || !r || !el) return
  const h = el.offsetHeight
  const w = el.offsetWidth
  const below = r.bottom + 6
  const above = r.top - h - 6
  const top = below + h <= window.innerHeight - 8 || above < 8 ? below : above
  /*
   * Anchored by its leading edge, which is the right one in Persian and Arabic — a list pinned by
   * its left edge in RTL grows away from the caret rather than under it. Then clamped to the
   * viewport, in coordinates that are the same in both directions.
   */
  const leading = getComputedStyle(el).direction === 'rtl' ? r.right - w : r.left
  const left = Math.min(Math.max(8, leading), Math.max(8, window.innerWidth - w - 8))
  if (pos.top !== top || pos.left !== left) pos = { top, left }
})

/*
 * The keyboard can walk past the bottom of a list that scrolls, and a highlight nobody can see is
 * the same as no highlight. `nearest` so a list that already shows the row does not jump.
 */
$effect(() => {
  void active
  menuEl?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
})

/** Where each heading goes: the first item of each run that names a new group. */
const headings = $derived(
  new Map(
    items.flatMap((item, i) =>
      item.group && item.group !== items[i - 1]?.group ? [[i, item.group] as const] : [],
    ),
  ),
)
</script>

{#if open && rect}
  <div
    bind:this={menuEl}
    class="kmenu ksug"
    role="listbox"
    aria-label={label}
    style="top: {pos.top}px; left: {pos.left}px"
  >
    {#if items.length === 0}
      <p class="ksug-empty">{t('editor.menu_empty')}</p>
    {/if}
    {#each items as item, i (item.id)}
      {#if headings.get(i)}<div class="kmenu-label">{headings.get(i)}</div>{/if}
      <div
        class="kmenu-item"
        class:on={i === active}
        role="option"
        aria-selected={i === active}
        tabindex="-1"
        onmousedown={(e) => {
          // The caret must not move: losing it closes the suggestion before the pick lands.
          e.preventDefault()
          onpick(i)
        }}
        onmouseenter={() => onhover(i)}
      >
        <span class="kmenu-ic">
          {#if item.avatar}
            <Avatar id={item.avatar.id} name={item.avatar.name} src={item.avatar.src} size={20} />
          {:else if item.icon}
            <Icon name={item.icon} size={15} strokeWidth={1.6} />
          {/if}
        </span>
        <span class="kmenu-l">{item.label}</span>
        {#if item.hint}<span class="kmenu-hint">{item.hint}</span>{/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  /*
   * `.kmenu.ksug` rather than `.ksug`: `.kmenu` comes from styles/menu.css and these override it,
   * so they need a specificity that does not depend on which stylesheet a bundler emits first.
   */
  :global(.kmenu.ksug) {
    position: fixed;
    width: 268px;
    max-height: 320px;
    overflow-y: auto;
    scroll-padding: 5px;
  }
  /*
   * Highlight, not hover: the keyboard moves the selection while the pointer sits still, and a row
   * that only lit up under the pointer would leave the arrow keys invisible.
   */
  :global(.kmenu.ksug .kmenu-item.on) {
    background: var(--kern-surface-popover-hover);
  }
  .ksug-empty {
    margin: 0;
    padding: 8px 9px;
    font-size: 13px;
    color: var(--kern-ink-400);
  }
</style>
