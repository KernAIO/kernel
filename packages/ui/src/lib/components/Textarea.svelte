<script lang="ts">
import type { HTMLTextareaAttributes } from 'svelte/elements'
import { cn } from '../utils.js'

interface Props extends HTMLTextareaAttributes {
  value?: string | null
  error?: string | null
  hint?: string
  /** grow with content */
  autosize?: boolean
  class?: string
  ref?: HTMLTextAreaElement | null
}
let {
  value = $bindable(''),
  error = null,
  hint,
  autosize = false,
  class: className,
  ref = $bindable(null),
  rows = 3,
  ...rest
}: Props = $props()
function grow(el: HTMLTextAreaElement) {
  if (!autosize) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight + 2}px`
}
$effect(() => {
  if (ref && autosize) {
    value
    grow(ref)
  }
})
</script>

<div class="kta-wrap">
  <textarea bind:this={ref} bind:value {rows} class={cn('kta', error && 'error', className)} aria-invalid={error ? 'true' : undefined} {...rest}></textarea>
  {#if error}<p class="kta-msg err">{error}</p>{:else if hint}<p class="kta-msg">{hint}</p>{/if}
</div>

<style>
  .kta-wrap { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
  .kta {
    width: 100%;
    box-sizing: border-box;
    padding: 9px 12px;
    border: 1px solid var(--kern-border-strong);
    border-radius: var(--kern-r-lg);
    background: var(--kern-surface-raised);
    color: var(--kern-ink-800);
    font-size: 13.5px;
    line-height: 1.5;
    resize: vertical;
    min-height: 36px;
    transition: border-color var(--kern-dur-fast), box-shadow var(--kern-dur-fast);
  }
  .kta:focus { outline: none; border-color: var(--kern-accent); box-shadow: 0 0 0 3px var(--kern-ring); }
  .kta.error { border-color: var(--kern-danger); }
  .kta-msg { margin: 0; font-size: 12px; color: var(--kern-ink-350); }
  .kta-msg.err { color: var(--kern-danger); }
</style>
