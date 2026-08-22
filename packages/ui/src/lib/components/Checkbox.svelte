<script lang="ts">
import { Checkbox as CheckboxPrimitive } from 'bits-ui'
import type { Snippet } from 'svelte'
import Icon from '../icons/Icon.svelte'
import { cn } from '../utils.js'

interface Props {
  checked?: boolean
  indeterminate?: boolean
  disabled?: boolean
  name?: string
  value?: string
  id?: string
  label?: string
  description?: string
  class?: string
  /** accessible name when the checkbox carries no visible label (matrix cells) */
  ariaLabel?: string
  onCheckedChange?: (v: boolean) => void
  children?: Snippet
}
let {
  checked = $bindable(false),
  indeterminate = $bindable(false),
  disabled = false,
  name,
  value,
  id,
  label,
  description,
  ariaLabel,
  class: className,
  onCheckedChange,
  children,
}: Props = $props()
</script>

<label class={cn('kcb', disabled && 'disabled', className)}>
  <CheckboxPrimitive.Root bind:checked bind:indeterminate {disabled} {name} {value} {id} {onCheckedChange} aria-label={ariaLabel} class="kcb-box">
    {#snippet children({ checked, indeterminate })}
      {#if indeterminate}<span class="dash"></span>{:else if checked}<Icon name="check" size={11} strokeWidth={2.6} />{/if}
    {/snippet}
  </CheckboxPrimitive.Root>
  {#if label || children || description}
    <span class="txt">
      <span class="l">{#if children}{@render children()}{:else}{label}{/if}</span>
      {#if description}<span class="d">{description}</span>{/if}
    </span>
  {/if}
</label>

<style>
  .kcb { display: inline-flex; align-items: flex-start; gap: 9px; cursor: pointer; font-size: 13.5px; color: var(--kern-ink-700); }
  .kcb.disabled { opacity: 0.5; cursor: not-allowed; }
  :global(.kcb-box) {
    width: 16px; height: 16px; flex: none; margin-top: 1px;
    border-radius: var(--kern-r-xs);
    border: 1px solid var(--kern-border-muted);
    background: var(--kern-surface-raised);
    display: inline-grid; place-items: center;
    color: var(--kern-ink-inverse);
    transition: background-color var(--kern-dur-fast), border-color var(--kern-dur-fast);
  }
  :global(.kcb-box[data-state='checked']), :global(.kcb-box[data-state='indeterminate']) { background: var(--kern-ink-900); border-color: var(--kern-ink-900); }
  :global(.kcb-box:focus-visible) { box-shadow: 0 0 0 3px var(--kern-ring); border-color: var(--kern-accent); }
  .dash { width: 8px; height: 2px; background: currentColor; border-radius: 1px; }
  .txt { display: flex; flex-direction: column; gap: 2px; line-height: 1.35; }
  .d { font-size: 12px; color: var(--kern-ink-350); }
</style>
