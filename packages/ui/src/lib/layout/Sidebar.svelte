<script lang="ts">
import type { Snippet } from 'svelte'

/** Sidebar content: header (switcher, 60px), control strip, scrolling nav, footer (52px). */
interface Props {
  header?: Snippet
  controls?: Snippet
  children?: Snippet
  footer?: Snippet
}
let { header, controls, children, footer }: Props = $props()
</script>

{#if header}<div class="ksb-head">{@render header()}</div>{/if}
{#if controls}<div class="ksb-ctl">{@render controls()}</div>{/if}
<nav class="ksb-nav">{@render children?.()}</nav>
{#if footer}<div class="ksb-foot">{@render footer()}</div>{/if}

<style>
  .ksb-head { height: 60px; flex: none; border-bottom: 1px solid var(--kern-border); display: flex; align-items: stretch; }
  .ksb-ctl { display: flex; align-items: center; gap: 6px; padding: 12px 12px 4px; flex: none; }
  .ksb-nav { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 0 0 14px; min-height: 0; }
  .ksb-foot { height: 52px; flex: none; border-top: 1px solid var(--kern-border); display: flex; align-items: center; gap: 10px; padding: 0 14px; }
</style>
