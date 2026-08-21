<script lang="ts">
import type { Snippet } from 'svelte'
import { cn } from '../utils.js'

/** Nav group: optional title row (mono label + rule + caret), collapsible, items stack gap 1px. */
interface Props {
  title?: string
  collapsible?: boolean
  open?: boolean
  count?: number | string | null
  class?: string
  trailing?: Snippet
  children: Snippet
}
let {
  title,
  collapsible = true,
  open = $bindable(true),
  count = null,
  class: className,
  trailing,
  children,
}: Props = $props()
</script>

<div class={cn('ksg', className)}>
  {#if title}
    <div class="ksg-title">
      {#if collapsible}
        <button type="button" class="tb" aria-expanded={open} onclick={() => (open = !open)}>
          <span class="kern-section-label">{title}</span>
          {#if count !== null}<span class="cnt">{count}</span>{/if}
        </button>
      {:else}
        <span class="kern-section-label">{title}</span>
        {#if count !== null}<span class="cnt">{count}</span>{/if}
      {/if}
      <span class="rule"></span>
      {#if trailing}<span class="tr">{@render trailing()}</span>{/if}
      {#if collapsible}
        <button type="button" class="caret-btn" aria-label={open ? 'Collapse' : 'Expand'} aria-expanded={open} onclick={() => (open = !open)}>
          <svg class="caret" class:closed={!open} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
      {/if}
    </div>
  {/if}
  {#if open || !collapsible}<div class="ksg-items">{@render children()}</div>{/if}
</div>

<style>
  .ksg { padding: 4px 12px 6px; }
  .ksg-title { display: flex; align-items: center; gap: 10px; height: 30px; }
  .ksg-title:hover { opacity: 0.85; }
  .tb { display: inline-flex; align-items: center; gap: 8px; }
  .cnt { font-family: var(--kern-font-mono); font-size: 11px; color: var(--kern-ink-250); }
  .rule { flex: 1; height: 1px; background: var(--kern-border); }
  .tr { display: inline-flex; align-items: center; }
  .caret-btn { display: grid; place-items: center; width: 16px; height: 16px; color: var(--kern-caret); }
  .caret { transition: transform 0.14s; }
  .caret.closed { transform: rotate(-90deg); }
  :global([dir='rtl']) .caret.closed { transform: rotate(90deg); }
  .ksg-items { display: flex; flex-direction: column; gap: 1px; }
</style>
