<script lang="ts">
import type { Snippet } from 'svelte'
import { cn } from '../utils.js'

/** Scroll body for a view: flex:1, overflow-y auto, content padding presets (DESIGN.md §1.4). */
interface Props {
  padding?: 'home' | 'list' | 'board' | 'docs' | 'inbox' | 'office' | 'none' | 'settings'
  maxWidth?: string
  class?: string
  children: Snippet
  ref?: HTMLDivElement | null
}
let { padding = 'list', maxWidth, class: className, children, ref = $bindable(null) }: Props = $props()
</script>
<div bind:this={ref} class={cn('kpage', `p-${padding}`, className)}><div class="inner" style:max-width={maxWidth}>{@render children()}</div></div>
<style>
  .kpage { flex: 1; overflow-y: auto; overflow-x: hidden; background: var(--kern-surface); min-height: 0; }
  /*
   * Centred, because `maxWidth` describes a measure rather than a left margin. Without this a
   * document page pinned its 780px column to the left of a 1352px area and left 540px of dead
   * space beside it — the reading column in one half of the screen and nothing in the other.
   * A page that sets no `maxWidth` is already full width, so `auto` does nothing there.
   */
  .inner { min-width: 0; margin-inline: auto; }
  .p-home { padding: 20px 24px 40px; }
  .p-list { padding: 18px 24px 44px; }
  .p-board { padding: 22px 28px 30px; }
  .p-docs { padding: 28px 32px 48px; }
  .p-inbox { padding: 24px 28px 40px; }
  .p-office { padding: 16px 24px 44px; }
  .p-settings { padding: 24px 28px 60px; }
  .p-none { padding: 0; }
  @media (max-width: 768px) { .kpage { padding-left: 16px; padding-right: 16px; } .p-none { padding: 0; } }
</style>
