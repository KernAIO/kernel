<script lang="ts">
import type { Snippet } from 'svelte'
import { cn } from '../utils.js'

/** 52px toolbar under the header: view toggles / filter / group-by on the start, preset tabs on the end (DESIGN.md §2.5). */
interface Props {
  children?: Snippet
  end?: Snippet
  class?: string
}
let { children, end, class: className }: Props = $props()
</script>

<div class={cn('ktb', className)} role="toolbar">
  <div class="s">{@render children?.()}</div>
  {#if end}<div class="e">{@render end()}</div>{/if}
</div>

<style>
  .ktb { display: flex; align-items: stretch; height: var(--kern-toolbar-h); padding: 0 28px; gap: 10px; border-bottom: 1px solid var(--kern-border); background: var(--kern-surface); flex: none; overflow-x: auto; }
  .s, .e { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .e { margin-inline-start: auto; height: 100%; }
  @media (max-width: 768px) { .ktb { padding: 0 16px; } }
</style>
