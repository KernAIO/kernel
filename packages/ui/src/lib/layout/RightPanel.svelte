<script lang="ts">
import type { Snippet } from 'svelte'
import IconButton from '../components/IconButton.svelte'
import { cn } from '../utils.js'

/** Docked right column (not an overlay): border-inline-start, optional 56px header, scroll body, footer. For overlays use <Sheet>. */
interface Props {
  title?: string
  width?: number
  header?: Snippet
  children: Snippet
  footer?: Snippet
  onClose?: () => void
  class?: string
  raised?: boolean
}
let {
  title,
  width = 440,
  header,
  children,
  footer,
  onClose,
  class: className,
  raised = true,
}: Props = $props()
</script>

<aside class={cn('krp', raised && 'raised', className)} style:--w="{width}px" aria-label={title}>
  {#if title || header || onClose}
    <div class="krp-head">
      {#if header}{@render header()}{:else if title}<span class="t">{title}</span>{/if}
      <span class="sp"></span>
      {#if onClose}<IconButton icon="x" label="Close" size={28} variant="sidebar" strokeWidth={1.8} onclick={onClose} />{/if}
    </div>
  {/if}
  <div class="krp-body">{@render children()}</div>
  {#if footer}<div class="krp-foot">{@render footer()}</div>{/if}
</aside>

<style>
  .krp { width: var(--w); max-width: 100%; flex: none; display: flex; flex-direction: column; min-height: 0; border-inline-start: 1px solid var(--kern-border-strong); background: var(--kern-surface); }
  .krp.raised { background: var(--kern-surface-raised); }
  .krp-head { display: flex; align-items: center; gap: 10px; height: 56px; flex: none; padding: 0 18px; border-bottom: 1px solid var(--kern-border); background: var(--kern-surface-header); }
  .t { font-size: 14px; font-weight: 600; color: var(--kern-ink-900); }
  .sp { flex: 1; }
  .krp-body { flex: 1; min-height: 0; overflow-y: auto; }
  .krp-foot { flex: none; border-top: 1px solid var(--kern-border); padding: 12px 16px; }
</style>
