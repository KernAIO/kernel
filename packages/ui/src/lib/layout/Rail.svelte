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
  .krail-items { display: flex; flex-direction: column; align-items: center; gap: 3px; overflow: hidden; min-height: 0; }
  .krail-sp { flex: 1; }
</style>
