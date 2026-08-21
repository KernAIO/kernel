<script lang="ts">
import { Switch as SwitchPrimitive } from 'bits-ui'
import { cn } from '../utils.js'

interface Props {
  checked?: boolean
  disabled?: boolean
  name?: string
  id?: string
  label?: string
  description?: string
  size?: 'sm' | 'md'
  class?: string
  onCheckedChange?: (v: boolean) => void
}
let {
  checked = $bindable(false),
  disabled = false,
  name,
  id,
  label,
  description,
  size = 'md',
  class: className,
  onCheckedChange,
}: Props = $props()
</script>

<label class={cn('ksw', `s-${size}`, disabled && 'disabled', className)}>
  {#if label || description}
    <span class="txt"><span class="l">{label}</span>{#if description}<span class="d">{description}</span>{/if}</span>
  {/if}
  <SwitchPrimitive.Root bind:checked {disabled} {name} {id} {onCheckedChange} class="ksw-track">
    <SwitchPrimitive.Thumb class="ksw-thumb" />
  </SwitchPrimitive.Root>
</label>

<style>
  .ksw { display: inline-flex; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer; font-size: 13.5px; color: var(--kern-ink-700); --w: 32px; --h: 18px; --t: 14px; }
  .ksw.s-sm { --w: 26px; --h: 15px; --t: 11px; }
  .ksw.disabled { opacity: 0.5; cursor: not-allowed; }
  .txt { display: flex; flex-direction: column; gap: 2px; line-height: 1.35; }
  .d { font-size: 12px; color: var(--kern-ink-350); }
  :global(.ksw-track) {
    position: relative; width: var(--w); height: var(--h); flex: none;
    border-radius: 999px; background: var(--kern-border-muted);
    transition: background-color 120ms; padding: 0; border: 0;
  }
  :global(.ksw-track[data-state='checked']) { background: var(--kern-ink-900); }
  :global(.ksw-track:focus-visible) { box-shadow: 0 0 0 3px var(--kern-ring); }
  :global(.ksw-thumb) {
    position: absolute; top: 2px; inset-inline-start: 2px; width: var(--t); height: var(--t);
    border-radius: 999px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    transition: transform 120ms var(--kern-ease-out); display: block;
  }
  :global(.ksw-track[data-state='checked'] .ksw-thumb) { transform: translateX(calc(var(--w) - var(--t) - 4px)); }
  :global([dir='rtl'] .ksw-track[data-state='checked'] .ksw-thumb) { transform: translateX(calc(-1 * (var(--w) - var(--t) - 4px))); }
</style>
