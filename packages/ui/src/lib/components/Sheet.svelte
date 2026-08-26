<script lang="ts">
import { Dialog as P } from 'bits-ui'
import type { Snippet } from 'svelte'
import { cn } from '../utils.js'
import IconButton from './IconButton.svelte'

/**
 * Right-side detail panel (440px). By default no backdrop (DESIGN.md §3.13); set `modal` to add one.
 * Pass `inline` to position absolutely inside the content column instead of the viewport.
 */
interface Props {
  open?: boolean
  title?: string
  width?: number
  modal?: boolean
  inline?: boolean
  side?: 'end' | 'start'
  trigger?: Snippet<[Record<string, unknown>]>
  header?: Snippet
  /** buttons that belong beside the close button, not beside the title */
  actions?: Snippet
  children: Snippet
  footer?: Snippet
  class?: string
  onOpenChange?: (o: boolean) => void
}
let {
  open = $bindable(false),
  title,
  width = 440,
  modal = false,
  inline = false,
  side = 'end',
  trigger,
  header,
  actions,
  children,
  footer,
  class: className,
  onOpenChange,
}: Props = $props()
</script>

<P.Root bind:open {onOpenChange}>
  {#if trigger}<P.Trigger>{#snippet child({ props })}{@render trigger(props)}{/snippet}</P.Trigger>{/if}
  <P.Portal disabled={inline}>
    {#if modal}<P.Overlay class="ksheet-overlay" />{/if}
    <P.Content class={cn('ksheet', `side-${side}`, inline && 'inline', className)} style="--w:{width}px" trapFocus={modal} preventScroll={modal} interactOutsideBehavior={modal ? 'close' : 'ignore'}>
      <div class="ksheet-head">
        {#if header}{@render header()}{:else if title}<P.Title class="ksheet-title">{title}</P.Title>{/if}
        <span class="sp"></span>
        {#if actions}{@render actions()}{/if}
        <P.Close>{#snippet child({ props })}<IconButton icon="x" label="Close" size={28} variant="sidebar" strokeWidth={1.8} {...props} />{/snippet}</P.Close>
      </div>
      <div class="ksheet-body">{@render children()}</div>
      {#if footer}<div class="ksheet-foot">{@render footer()}</div>{/if}
    </P.Content>
  </P.Portal>
</P.Root>

<style>
  :global(.ksheet-overlay) { position: fixed; inset: 0; background: var(--kern-overlay); z-index: var(--kern-z-sheet); animation: kfade 0.1s ease-out; }
  :global(.ksheet) {
    position: fixed; top: 0; bottom: 0; inset-inline-end: 0; width: var(--w); max-width: 100vw;
    display: flex; flex-direction: column;
    background: var(--kern-surface-raised); border-inline-start: 1px solid var(--kern-border-strong); box-shadow: var(--kern-shadow-panel);
    z-index: calc(var(--kern-z-sheet) + 1); outline: none; animation: kslide 0.16s ease-out;
  }
  :global([dir='rtl'] .ksheet) { animation-name: kslide-rtl; }
  :global(.ksheet.inline) { position: absolute; }
  :global(.ksheet.side-start) { inset-inline-end: auto; inset-inline-start: 0; border-inline-start: 0; border-inline-end: 1px solid var(--kern-border-strong); animation-name: kslide-rtl; }
  :global([dir='rtl'] .ksheet.side-start) { animation-name: kslide; }
  .ksheet-head { display: flex; align-items: center; gap: 10px; height: 56px; flex: none; padding: 0 18px; border-bottom: 1px solid var(--kern-border); background: var(--kern-surface-header); }
  :global(.ksheet-title) { font-size: 14px; font-weight: 600; color: var(--kern-ink-900); letter-spacing: -0.01em; }
  .sp { flex: 1; }
  .ksheet-body { flex: 1; overflow-y: auto; padding: 18px 20px; min-height: 0; }
  .ksheet-foot { flex: none; border-top: 1px solid var(--kern-border); padding: 12px 16px; }
  @media (max-width: 768px) { :global(.ksheet) { width: 100vw; } }
</style>
