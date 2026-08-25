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
  /** accessible name when the switch carries no visible label */
  ariaLabel?: string
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
  ariaLabel,
}: Props = $props()

/* see `Checkbox`: the track is a `<button role="switch">`, which a `<label>` cannot name, and the
   id must come from `$props.id()` rather than a counter that resets for every instance */
const uid = $props.id()
const textId = `ksw-l${uid}`

/**
 * A `<label for>` elsewhere on the page — `SettingsRow` writes one — does not name this control
 * either: `for` associates a label with a *form control*, and the track is a button. So when the
 * switch carries no visible label of its own, it adopts that label by id after mount, where whether
 * one exists is a fact rather than an assumption.
 */
let adoptedId = $state<string | undefined>(undefined)
$effect(() => {
  if (label || ariaLabel || !id) return
  const external = document.querySelector(`label[for="${CSS.escape(id)}"]`)
  if (!external) return
  if (!external.id) external.id = `${id}-label`
  adoptedId = external.id
})

const labelledBy = $derived(label ? textId : adoptedId)
</script>

<label class={cn('ksw', `s-${size}`, disabled && 'disabled', className)}>
  {#if label || description}
    <span class="txt"><span class="l" id={textId}>{label}</span>{#if description}<span class="d">{description}</span>{/if}</span>
  {/if}
  <SwitchPrimitive.Root bind:checked {disabled} {name} {id} {onCheckedChange} aria-label={labelledBy ? undefined : ariaLabel} aria-labelledby={labelledBy} class="ksw-track">
    <SwitchPrimitive.Thumb class="ksw-thumb" />
  </SwitchPrimitive.Root>
</label>

<style>
  .ksw { display: inline-flex; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer; font-size: 13.5px; color: var(--kern-ink-700); --w: 32px; --h: 18px; --t: 14px; }
  .ksw.s-sm { --w: 26px; --h: 15px; --t: 11px; }
  /*
   * 0.7, not 0.5. A disabled control is exempt from the contrast rule, but exempt is not the same as
   * unreadable: the required capabilities on the HR switchboard are permanently disabled, and at 0.5
   * their labels were 2.8:1 — a list nobody could read, describing what the workspace has turned on.
   * 0.7 is the point where ink-700 still clears 4.5:1 on the palest surface, and it is far enough
   * from full strength to still read as off.
   */
  .ksw.disabled { opacity: 0.7; cursor: not-allowed; }
  .txt { display: flex; flex-direction: column; gap: 2px; line-height: 1.35; }
  .d { font-size: 12px; color: var(--kern-ink-350); }
  :global(.ksw-track) {
    position: relative; width: var(--w); height: var(--h); flex: none;
    border-radius: 999px; background: var(--kern-border-muted);
    transition: background-color 120ms; padding: 0; border: 0;
  }
    /* accent rather than ink: in dark mode ink-900 is near-white, which leaves a white thumb on a
     white track and reads as off */
  :global(.ksw-track[data-state='checked']) { background: var(--kern-accent); }
  :global(.ksw-track:focus-visible) { box-shadow: 0 0 0 3px var(--kern-ring); }
  :global(.ksw-thumb) {
    position: absolute; top: 2px; inset-inline-start: 2px; width: var(--t); height: var(--t);
    border-radius: 999px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    transition: transform 120ms var(--kern-ease-out); display: block;
  }
  :global(.ksw-track[data-state='checked'] .ksw-thumb) { transform: translateX(calc(var(--w) - var(--t) - 4px)); }
  :global([dir='rtl'] .ksw-track[data-state='checked'] .ksw-thumb) { transform: translateX(calc(-1 * (var(--w) - var(--t) - 4px))); }
</style>
