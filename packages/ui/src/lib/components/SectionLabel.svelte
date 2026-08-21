<script lang="ts">
import type { Snippet } from 'svelte'
import { cn } from '../utils.js'

/** DM Mono uppercase label + optional count + 1px rule + trailing slot (DESIGN.md §3.0). */
interface Props {
  label: string
  count?: string | number | null
  class?: string
  trailing?: Snippet /** sans uppercase sub-label variant (11px w600) */
  sub?: boolean
  collapsible?: boolean
  open?: boolean
  onToggle?: () => void
}
let {
  label,
  count = null,
  class: className,
  trailing,
  sub = false,
  collapsible = false,
  open = true,
  onToggle,
}: Props = $props()
</script>

<div class={cn('ksl', sub && 'sub', className)}>
  {#if collapsible}
    <button type="button" class="lbl btn" aria-expanded={open} onclick={onToggle}>
      <span class={sub ? 'kern-sublabel' : 'kern-section-label'}>{label}</span>
      <svg class="caret" class:closed={!open} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </button>
  {:else}
    <span class={sub ? 'kern-sublabel' : 'kern-section-label'}>{label}</span>
  {/if}
  {#if count !== null && count !== undefined}<span class="cnt">{count}</span>{/if}
  <span class="rule"></span>
  {#if trailing}<span class="tr">{@render trailing()}</span>{/if}
</div>

<style>
  .ksl { display: flex; align-items: center; gap: 10px; height: 32px; min-width: 0; }
  .cnt { font-family: var(--kern-font-mono); font-size: 11.5px; color: var(--kern-ink-250); letter-spacing: -0.01em; }
  .rule { flex: 1; height: 1px; background: var(--kern-border); }
  .tr { display: inline-flex; align-items: center; gap: 4px; }
  .btn { display: inline-flex; align-items: center; gap: 6px; color: var(--kern-caret); }
  .btn:hover { opacity: 0.75; }
  .caret { transition: transform 0.14s; }
  .caret.closed { transform: rotate(-90deg); }
  :global([dir='rtl']) .caret.closed { transform: rotate(90deg); }
</style>
