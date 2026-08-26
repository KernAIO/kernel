<script lang="ts">
import { Dialog as P } from 'bits-ui'
import type { Snippet } from 'svelte'
import { cn } from '../utils.js'
import IconButton from './IconButton.svelte'

interface Props {
  open?: boolean
  title?: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  trigger?: Snippet<[Record<string, unknown>]>
  children: Snippet
  footer?: Snippet
  class?: string
  /** remove body padding (for custom layouts) */
  flush?: boolean
  /**
   * What holds focus when the dialog opens. Defaults to the first control in the body, which is
   * almost always what someone wants to type into. Pass an element getter to be explicit, or
   * `false` to leave the browser and bits-ui to it.
   */
  initialFocus?: (() => HTMLElement | null | undefined) | string | false
  hideClose?: boolean
  onOpenChange?: (o: boolean) => void
}
let {
  open = $bindable(false),
  title,
  description,
  size = 'md',
  trigger,
  children,
  footer,
  class: className,
  flush = false,
  hideClose = false,
  initialFocus,
  onOpenChange,
}: Props = $props()

let bodyEl = $state<HTMLElement | null>(null)

const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"], button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

/**
 * Without this the close button is the first tabbable element in the dialog, so it takes focus on
 * open — and then a space in what someone thought was the title field closes the dialog and throws
 * away what they typed. Focus goes to the first control in the body instead. A dialog whose body
 * has nothing focusable (a confirmation, say) keeps the default: close is a safe thing to activate.
 */
function focusOnOpen(event: Event) {
  if (initialFocus === false) return
  const target =
    typeof initialFocus === 'function'
      ? initialFocus()
      : (bodyEl?.querySelector<HTMLElement>(typeof initialFocus === 'string' ? initialFocus : FOCUSABLE) ??
        null)
  if (!target) return
  event.preventDefault()
  target.focus()
}
</script>

<P.Root bind:open {onOpenChange}>
  {#if trigger}<P.Trigger>{#snippet child({ props })}{@render trigger(props)}{/snippet}</P.Trigger>{/if}
  <P.Portal>
    <P.Overlay class="kdlg-overlay" />
    <P.Content class={cn('kdlg', `s-${size}`, className)} onOpenAutoFocus={focusOnOpen}>
      {#if title || !hideClose}
        <div class="kdlg-head">
          <div class="tt">
            {#if title}<P.Title class="kdlg-title">{title}</P.Title>{/if}
            {#if description}<P.Description class="kdlg-desc">{description}</P.Description>{/if}
          </div>
          {#if !hideClose}<P.Close>{#snippet child({ props })}<IconButton icon="x" label="Close" size={28} variant="ghost" strokeWidth={1.8} {...props} />{/snippet}</P.Close>{/if}
        </div>
      {/if}
      <div bind:this={bodyEl} class={cn('kdlg-body', flush && 'flush')}>{@render children()}</div>
      {#if footer}<div class="kdlg-foot">{@render footer()}</div>{/if}
    </P.Content>
  </P.Portal>
</P.Root>

<style>
  :global(.kdlg-overlay) { position: fixed; inset: 0; background: var(--kern-overlay); z-index: var(--kern-z-dialog); animation: kfade 0.1s ease-out; }
  :global(.kdlg) {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 480px; max-width: calc(100vw - 32px); max-height: calc(100dvh - 48px);
    display: flex; flex-direction: column;
    background: var(--kern-surface-raised); border-radius: var(--kern-r-dialog); box-shadow: var(--kern-shadow-dialog);
    z-index: calc(var(--kern-z-dialog) + 1); outline: none; overflow: hidden; animation: kfade 0.12s ease-out;
  }
  :global(.kdlg.s-sm) { width: 400px; }
  :global(.kdlg.s-lg) { width: 640px; }
  :global(.kdlg.s-xl) { width: 860px; }
  .kdlg-head { display: flex; align-items: flex-start; gap: 12px; padding: 18px 20px 0; }
  .tt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  :global(.kdlg-title) { font-size: 17px; font-weight: 600; letter-spacing: -0.015em; color: var(--kern-ink-900); line-height: 1.3; }
  :global(.kdlg-desc) { font-size: 13px; color: var(--kern-ink-400); line-height: 1.45; }
  .kdlg-body { padding: 16px 20px 20px; overflow-y: auto; min-height: 0; }
  .kdlg-body.flush { padding: 0; }
  .kdlg-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--kern-border); background: var(--kern-surface-header); }
  @media (max-width: 640px) {
    :global(.kdlg) { top: auto; bottom: 0; left: 0; transform: none; width: 100vw; max-width: 100vw; border-radius: var(--kern-r-dialog) var(--kern-r-dialog) 0 0; animation: kslide-up 0.16s ease-out; }
  }
</style>
