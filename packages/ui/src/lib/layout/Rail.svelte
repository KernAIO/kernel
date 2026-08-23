<script lang="ts">
import type { Snippet } from 'svelte'

/** Icon rail content: logo/top, divider, items, spacer, bottom. Place inside AppShell's `rail` snippet. */
interface Props {
  top?: Snippet
  children?: Snippet
  bottom?: Snippet
}
let { top, children, bottom }: Props = $props()
</script>

{#if top}{@render top()}<div class="krail-div"></div>{/if}
<div class="krail-items">{@render children?.()}</div>
<div class="krail-sp"></div>
{#if bottom}<div class="krail-div b"></div>{@render bottom()}{/if}

<style>
  .krail-div { width: 22px; height: 1px; background: var(--kern-border-muted); margin: 14px 0 10px; flex: none; }
  .krail-div.b { margin: 10px 0 10px; }
  /*
   * `overflow: hidden` is the rail's no-scroll rule (DESIGN.md 2.2): too many modules are cut off,
   * they never turn the rail into a scroller. But the clip box is the padding box, and a RailItem's
   * unread badge sits outside its 34px button (-3px/-4px, plus a 2px ring) — so the bare rule
   * sliced the badge off, most visibly in RTL where `inset-inline-end` is the left edge.
   * The padding widens the clip box by the overhang; the equal negative margin cancels it again, so
   * the margin box is exactly the content box was and nothing moves.
   */
  .krail-items { display: flex; flex-direction: column; align-items: center; gap: 3px; overflow: hidden; min-height: 0; padding: 6px 8px; margin: -6px -8px; }
  .krail-sp { flex: 1; }
</style>
