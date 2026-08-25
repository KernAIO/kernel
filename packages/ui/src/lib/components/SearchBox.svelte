<script lang="ts">
import type { HTMLInputAttributes } from 'svelte/elements'
import Icon from '../icons/Icon.svelte'
import { cn } from '../utils.js'
import Kbd from './Kbd.svelte'

/** 32–34px paper search box with magnifier (sidebar "Search this space" / header "Search"). */
interface Props extends HTMLInputAttributes {
  value?: string
  height?: 32 | 34 /** show ⌘K chip on the end */
  kbd?: string[]
  width?: string
  class?: string
  ref?: HTMLInputElement | null
  onEnter?: (v: string) => void
  loading?: boolean
  /**
   * What this box searches, for a screen reader. Defaults to the placeholder, which is the same
   * sentence — but a placeholder is not a name: it is not announced by every reader, and it is gone
   * the moment somebody types. Pass this when the placeholder is a hint rather than a label.
   */
  label?: string
}
let {
  value = $bindable(''),
  height = 34,
  kbd,
  width,
  class: className,
  ref = $bindable(null),
  onEnter,
  loading = false,
  label,
  ...rest
}: Props = $props()
</script>

<div class={cn('ksb', className)} style:height="{height}px" style:width={width}>
  <Icon name={loading ? 'loader' : 'search'} size={14} strokeWidth={1.7} class={loading ? 'ksb-ic spin' : 'ksb-ic'} />
  <input bind:this={ref} bind:value type="search" aria-label={label ?? (typeof rest.placeholder === 'string' ? rest.placeholder : 'Search')} autocomplete="off" spellcheck="false" onkeydown={(e) => { if (e.key === 'Enter') onEnter?.(value); if (e.key === 'Escape') { value = ''; (e.currentTarget as HTMLInputElement).blur() } }} {...rest} />
  {#if value}<button type="button" class="clr" aria-label="Clear" onclick={() => { value = ''; ref?.focus() }}><Icon name="x" size={12} strokeWidth={2} /></button>
  {:else if kbd}<Kbd keys={kbd} chip />{/if}
</div>

<style>
  .ksb { display: flex; align-items: center; gap: 8px; padding: 0 11px; border-radius: var(--kern-r-xl); background: var(--kern-surface-input); border: 1px solid var(--kern-border); min-width: 0; transition: border-color var(--kern-dur-fast), box-shadow var(--kern-dur-fast); }
  .ksb:focus-within { border-color: var(--kern-accent); box-shadow: 0 0 0 3px var(--kern-ring); }
  :global(.ksb .ksb-ic) { color: var(--kern-ink-250); flex: none; }
  :global(.ksb .spin) { animation: kspin 0.8s linear infinite; }
  @keyframes kspin { to { transform: rotate(360deg); } }
  input { flex: 1; min-width: 0; height: 100%; background: transparent; border: 0; outline: none; box-shadow: none; font-size: 13px; color: var(--kern-ink-700); padding: 0; }
  input::placeholder { color: var(--kern-ink-250); font-size: 13.5px; }
  input::-webkit-search-cancel-button { display: none; }
  .clr { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 4px; color: var(--kern-ink-350); }
  .clr:hover { background: var(--kern-border); color: var(--kern-ink-900); }
</style>
