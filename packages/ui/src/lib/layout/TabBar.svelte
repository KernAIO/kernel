<script lang="ts">
import type { Snippet } from 'svelte'
import DropdownMenu from '../components/DropdownMenu.svelte'
import type { MenuItem } from '../components/menu-types.js'
import Icon from '../icons/Icon.svelte'
import { cn } from '../utils.js'
import TabBarItem from './TabBarItem.svelte'

/**
 * The window strip that runs above the whole shell (DESIGN.md §2.0).
 *
 * It is presentational: it is handed tabs and reports what was done to them. Who owns the list, what
 * a tab is called and where it points are the application's business — which is what lets the same
 * strip carry a workspace's open places here and something else entirely in another host.
 *
 * Tabs reorder by dragging, and the same two moves are in the context menu, because dragging is not
 * available to anyone driving the strip from the keyboard.
 */
export interface TabBarTab {
  id: string
  label: string
  icon?: string
  pinned?: boolean
  dot?: boolean
  title?: string
}

interface Props {
  tabs: TabBarTab[]
  /** Name of the navigation landmark the strip forms. */
  label?: string
  activeId?: string | null
  onselect?: (id: string) => void
  onclose?: (id: string) => void
  /** Both indices are into `tabs`; the strip never reorders itself. */
  onreorder?: (from: number, to: number) => void
  menuFor?: (id: string) => MenuItem[]
  /** Destinations offered by the "+" button. With none, it falls back to `onnew`. */
  newItems?: MenuItem[]
  onnew?: () => void
  newLabel?: string
  closeLabel?: string
  /** Trailing controls — search, clock, settings. */
  actions?: Snippet
  class?: string
}
let {
  tabs,
  label = 'Open tabs',
  activeId = null,
  onselect,
  onclose,
  onreorder,
  menuFor,
  newItems,
  onnew,
  newLabel = 'New tab',
  closeLabel = 'Close tab',
  actions,
  class: className,
}: Props = $props()

let strip = $state<HTMLDivElement | null>(null)
let dragFrom = $state<number | null>(null)
let dragOver = $state<number | null>(null)
let startX = 0
let dragging = false

// keep the tab you just switched to on screen when the strip has scrolled
$effect(() => {
  const id = activeId
  if (!id || !strip) return
  const el = strip.querySelector<HTMLElement>(`[data-tab="${CSS.escape(id)}"]`)
  el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
})

/** A strip is a horizontal thing; a vertical wheel over it should move it sideways. */
function wheel(e: WheelEvent) {
  if (!strip || e.deltaX !== 0 || e.shiftKey) return
  if (strip.scrollWidth <= strip.clientWidth) return
  e.preventDefault()
  strip.scrollLeft += e.deltaY
}

/**
 * Dragging a tab, on pointer events rather than HTML5 drag-and-drop.
 *
 * `draggable` would be less code, but a tab is a button, and whether dragging one starts a native
 * drag differs between browsers. Pointer events behave the same everywhere and leave the click
 * alone, so a drag still activates the tab it lands on — which is what a browser does.
 *
 * The move and release handlers are on the window, not the tab: a pointer that leaves the strip
 * mid-drag — or is released over the page — must still finish the drag rather than strand it.
 *
 * Touch is left out deliberately: following it would stop the strip scrolling, which matters more on
 * a small screen. Reordering from the keyboard, or by touch, is in the context menu.
 */
function grab(e: PointerEvent, index: number) {
  if (e.button !== 0 || e.pointerType === 'touch' || !onreorder) return
  dragFrom = index
  dragOver = index
  startX = e.clientX
  dragging = false
}

function move(e: PointerEvent) {
  if (dragFrom === null) return
  // a few pixels of slack, so a slightly unsteady click is still a click
  if (!dragging && Math.abs(e.clientX - startX) < 5) return
  dragging = true
  dragOver = indexAt(e.clientX)
}

function release() {
  const from = dragFrom
  const to = dragOver
  dragFrom = null
  dragOver = null
  if (!dragging || from === null || to === null || from === to) return
  dragging = false
  onreorder?.(from, to)
}

/** Which tab the pointer is over. In RTL the strip runs the other way while the DOM does not. */
function indexAt(x: number): number {
  if (!strip) return 0
  const slots = Array.from(strip.querySelectorAll<HTMLElement>('.slot'))
  const rtl = getComputedStyle(strip).direction === 'rtl'
  for (let i = 0; i < slots.length; i += 1) {
    const box = (slots[i] as HTMLElement).getBoundingClientRect()
    const middle = box.left + box.width / 2
    if (rtl ? x > middle : x < middle) return i
  }
  return Math.max(0, slots.length - 1)
}
</script>

<svelte:window onpointermove={move} onpointerup={release} onpointercancel={release} />

<!--
  A navigation landmark of plain buttons rather than an ARIA tablist: these tabs are places in the
  workspace, not panels of one widget, and `aria-current` says which one is open. Claiming the tab
  pattern would promise a `tabpanel` relationship that does not exist.
-->
<nav class={cn('ktabbar', className)} aria-label={label}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="strip" bind:this={strip} onwheel={wheel}>
    {#each tabs as tab, i (tab.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="slot"
        class:lifted={dragFrom === i}
        class:over={dragOver === i && dragFrom !== null && dragFrom !== i}
        class:after={dragOver === i && dragFrom !== null && dragFrom < i}
        data-tab={tab.id}
        onpointerdown={(e) => grab(e, i)}
        onauxclick={(e) => {
          // middle click closes, as it does in a browser
          if (e.button !== 1) return
          e.preventDefault()
          onclose?.(tab.id)
        }}
      >
        <TabBarItem
          label={tab.label}
          icon={tab.icon}
          pinned={tab.pinned}
          dot={tab.dot}
          title={tab.title}
          active={tab.id === activeId}
          menu={menuFor?.(tab.id)}
          {closeLabel}
          onselect={() => onselect?.(tab.id)}
          onclose={() => onclose?.(tab.id)}
        />
      </div>
    {/each}

    {#if newItems?.length}
      <DropdownMenu items={newItems} align="start">
        {#snippet trigger(props)}
          <button {...props} type="button" class="new" aria-label={newLabel} title={newLabel}>
            <Icon name="plus" size={14} strokeWidth={1.9} />
          </button>
        {/snippet}
      </DropdownMenu>
    {:else if onnew}
      <button type="button" class="new" aria-label={newLabel} title={newLabel} onclick={onnew}>
        <Icon name="plus" size={14} strokeWidth={1.9} />
      </button>
    {/if}
  </div>

  {#if actions}<div class="acts">{@render actions()}</div>{/if}
</nav>

<style>
  .ktabbar {
    display: flex; align-items: center; gap: 8px;
    height: var(--kern-tabbar-h); padding: 0 8px 0 10px;
    background: var(--kern-shell); border-bottom: 1px solid var(--kern-border);
    min-width: 0;
  }
  .strip {
    display: flex; align-items: center; gap: 2px;
    flex: 1; min-width: 0; height: 100%;
    overflow-x: auto; overflow-y: hidden;
    scrollbar-width: none;
  }
  .strip::-webkit-scrollbar { display: none; }
  .slot { position: relative; flex: none; }
  .slot.lifted { opacity: 0.45; }
  /* the insertion point, drawn on the side the tab would land on */
  .slot.over::before {
    content: ''; position: absolute; top: 3px; bottom: 3px; inset-inline-start: -2px;
    width: 2px; border-radius: 1px; background: var(--kern-accent);
  }
  .slot.over.after::before { inset-inline-start: auto; inset-inline-end: -2px; }
  .new {
    display: grid; place-items: center; flex: none;
    width: 24px; height: 24px; margin-inline-start: 2px;
    border: 0; border-radius: var(--kern-r-md); background: transparent;
    color: var(--kern-ink-350); cursor: pointer;
  }
  .new:hover { background: var(--kern-surface-hover); color: var(--kern-ink-900); }
  .new:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--kern-ring); }
  .acts { display: flex; align-items: center; gap: 4px; flex: none; }
</style>
