<script lang="ts">
import ContextMenu from '../components/ContextMenu.svelte'
import type { MenuItem } from '../components/menu-types.js'
import Icon from '../icons/Icon.svelte'
import { cn } from '../utils.js'

/**
 * One tab in the window strip (DESIGN.md §2.0).
 *
 * A tab is a place you left open, not a navigation item, so it is drawn as paper rather than ink:
 * the active one takes `surface-active` — the token DESIGN.md already reserves for "active tab bg" —
 * and the rest stay flat until hovered. The close button only appears on the active tab or on hover,
 * so a full strip reads as labels rather than as a row of crosses.
 *
 * Pinned tabs shrink to their icon: they are the ones you keep, so they should cost the least width.
 */
interface Props {
  label: string
  icon?: string
  active?: boolean
  pinned?: boolean
  /** Unread marker for a tab you are not looking at. */
  dot?: boolean
  closable?: boolean
  menu?: MenuItem[]
  closeLabel?: string
  title?: string
  class?: string
  onselect?: () => void
  onclose?: () => void
}
let {
  label,
  icon,
  active = false,
  pinned = false,
  dot = false,
  closable = true,
  menu,
  closeLabel = 'Close',
  title,
  class: className,
  onselect,
  onclose,
}: Props = $props()
</script>

{#snippet tab()}
  <button
    type="button"
    class={cn('ktab', active && 'active', pinned && 'pinned', className)}
    aria-current={active ? 'page' : undefined}
    title={title ?? label}
    onclick={onselect}
  >
    {#if icon}<span class="ic"><Icon name={icon} size={13} strokeWidth={1.7} /></span>{/if}
    {#if !pinned}<span class="lb">{label}</span>{/if}
    {#if dot && !active}<span class="dot" aria-hidden="true"></span>{/if}
    {#if closable && !pinned}
      <!-- a button inside a button is invalid, so the close affordance is a span with a role -->
      <span
        role="button"
        tabindex="-1"
        class="cl"
        aria-label={closeLabel}
        onclick={(e) => {
          e.stopPropagation()
          onclose?.()
        }}
        onkeydown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          e.stopPropagation()
          onclose?.()
        }}
      >
        <Icon name="x" size={11} strokeWidth={2} />
      </span>
    {/if}
  </button>
{/snippet}

{#if menu?.length}
  <ContextMenu items={menu} class="ktab-ctx">{@render tab()}</ContextMenu>
{:else}
  {@render tab()}
{/if}

<style>
  :global(.ktab-ctx) { display: contents; }
  .ktab {
    display: inline-flex; align-items: center; gap: 6px; flex: none;
    height: 26px; max-width: 190px; padding: 0 6px 0 9px;
    border: 1px solid transparent; border-radius: var(--kern-r-md2);
    background: transparent; color: var(--kern-ink-450);
    font-family: inherit; font-size: 12.5px; letter-spacing: -0.005em; line-height: 1;
    cursor: pointer; user-select: none;
    transition: background-color var(--kern-dur-fast) var(--kern-ease-out), color var(--kern-dur-fast) var(--kern-ease-out);
  }
  .ktab.pinned { max-width: none; padding: 0 7px; }
  .ktab:hover { background: var(--kern-surface-hover); color: var(--kern-ink-700); }
  .ktab.active {
    background: var(--kern-surface-active); border-color: var(--kern-border);
    color: var(--kern-ink-900); font-weight: 600;
  }
  .ktab:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--kern-ring); }
  .ic { display: grid; place-items: center; flex: none; color: var(--kern-ink-330); }
  .ktab.active .ic { color: var(--kern-ink-700); }
  .lb { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dot { width: 5px; height: 5px; border-radius: 999px; background: var(--kern-danger); flex: none; }
  .cl {
    display: grid; place-items: center; flex: none;
    position: relative;
    width: 15px; height: 15px; margin-inline-start: -1px;
    border-radius: var(--kern-r-xs); color: var(--kern-ink-350);
    opacity: 0; cursor: pointer;
  }
  /*
   * 15px is what is drawn; 24px is what you have to hit. A tab sits directly beside its own close
   * button, so the pointer target and the tab target are inside each other's 24px reach — which is
   * the crowding half of WCAG 2.5.8, and it is worst in RTL, where the close button lands on the
   * side the thumb comes from. The overlay grows the target without moving anything on screen.
   */
  .cl::after {
    content: '';
    position: absolute;
    inset: -5px;
  }
  .ktab:hover .cl, .ktab.active .cl, .cl:focus-visible { opacity: 1; }
  .cl:hover { background: var(--kern-ghost-hover-dark); color: var(--kern-ink-900); }
  /* touch and keyboard users get no hover: never hide the only way to close a tab */
  @media (hover: none) { .cl { opacity: 1; } }
</style>
