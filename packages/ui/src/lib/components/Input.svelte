<script lang="ts">
import type { HTMLInputAttributes } from 'svelte/elements'
import Icon from '../icons/Icon.svelte'
import { cn } from '../utils.js'

interface Props extends Omit<HTMLInputAttributes, 'size'> {
  value?: string | number | null
  /** leading lucide icon */
  icon?: string
  /** error message (renders red border + text below) */
  error?: string | null
  /** helper text */
  hint?: string
  /** height variant */
  size?: 'sm' | 'md'
  /** mono font (keys, slugs, codes) */
  mono?: boolean
  class?: string
  wrapperClass?: string
  ref?: HTMLInputElement | null
}
let {
  value = $bindable(''),
  icon,
  error = null,
  hint,
  size = 'md',
  mono = false,
  class: className,
  wrapperClass,
  ref = $bindable(null),
  id,
  ...rest
}: Props = $props()
</script>

<div class={cn('kin-wrap', wrapperClass)}>
  <div class={cn('kin', `s-${size}`, error && 'error', icon && 'has-icon', mono && 'mono', className)}>
    {#if icon}<Icon name={icon} size={14} strokeWidth={1.7} class="kin-icon" />{/if}
    <input bind:this={ref} bind:value {id} aria-invalid={error ? 'true' : undefined} aria-describedby={error || hint ? `${id ?? 'in'}-desc` : undefined} {...rest} />
  </div>
  {#if error}<p class="kin-msg err" id="{id ?? 'in'}-desc">{error}</p>{:else if hint}<p class="kin-msg" id="{id ?? 'in'}-desc">{hint}</p>{/if}
</div>

<style>
  .kin-wrap { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
  .kin {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 12px;
    border: 1px solid var(--kern-border-strong);
    border-radius: var(--kern-r-lg);
    background: var(--kern-surface-raised);
    color: var(--kern-ink-800);
    font-size: 13.5px;
    transition: border-color var(--kern-dur-fast), box-shadow var(--kern-dur-fast);
  }
  .kin.s-sm { height: 32px; font-size: 13px; padding: 0 10px; border-radius: var(--kern-r-md2); }
  .kin:focus-within { border-color: var(--kern-accent); box-shadow: 0 0 0 3px var(--kern-ring); }
  .kin.error { border-color: var(--kern-danger); }
  .kin.error:focus-within { box-shadow: 0 0 0 3px var(--kern-danger-tint); }
  .kin input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: 0;
    outline: none;
    background: transparent;
    padding: 0;
    box-shadow: none;
  }
  .kin input:disabled { color: var(--kern-ink-350); cursor: not-allowed; }
  .kin.mono input { font-family: var(--kern-font-mono); letter-spacing: -0.01em; }
  :global(.kin .kin-icon) { color: var(--kern-ink-250); flex: none; }
  .kin-msg { margin: 0; font-size: 12px; color: var(--kern-ink-350); }
  .kin-msg.err { color: var(--kern-danger); }
</style>
