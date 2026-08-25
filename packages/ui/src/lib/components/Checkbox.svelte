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

/*
 * bits-ui renders the control as `<button role="checkbox">`, and a wrapping `<label>` names form
 * controls — not buttons. So the visible label sat beside a control that announced itself as
 * "checkbox" and nothing else. `aria-labelledby` pointed at the text keeps the name a reader hears
 * identical to the one on screen, which `aria-label` would not guarantee.
 *
 * The id comes from `$props.id()`, which is unique per instance. A counter is not: everything in a
 * Svelte `<script>` runs per instance, so it restarts at 0 every time and every checkbox on the page
 * ends up pointing at the same label — three of them answered to "Show archived" before this.
 * `$props.id()` has to be the whole initialiser of its own `const`; inside a template literal the
 * compiler rejects it, and `svelte-package` does not compile, so that error only appears in the
 * consumer's build.
 */
const uid = $props.id()
const textId = `kcb-l${uid}`
const hasVisibleText = $derived(Boolean(label || children))

/** and a `<label for>` written elsewhere does not reach a button either — adopt it by id */
let adoptedId = $state<string | undefined>(undefined)
$effect(() => {
  if (hasVisibleText || ariaLabel || !id) return
  const external = document.querySelector(`label[for="${CSS.escape(id)}"]`)
  if (!external) return
  if (!external.id) external.id = `${id}-label`
  adoptedId = external.id
})

const labelledBy = $derived(hasVisibleText ? textId : adoptedId)
</script>

<label class={cn('kcb', disabled && 'disabled', className)}>
  <CheckboxPrimitive.Root bind:checked bind:indeterminate {disabled} {name} {value} {id} {onCheckedChange} aria-label={labelledBy ? undefined : ariaLabel} aria-labelledby={labelledBy} class="kcb-box">
    {#snippet children({ checked, indeterminate })}
      {#if indeterminate}<span class="dash"></span>{:else if checked}<Icon name="check" size={11} strokeWidth={2.6} />{/if}
    {/snippet}
  </CheckboxPrimitive.Root>
  {#if label || children || description}
    <span class="txt">
      <span class="l" id={textId}>{#if children}{@render children()}{:else}{label}{/if}</span>
      {#if description}<span class="d">{description}</span>{/if}
    </span>
  {/if}
</label>

<style>
  .kcb { display: inline-flex; align-items: flex-start; gap: 9px; cursor: pointer; font-size: 13.5px; color: var(--kern-ink-700); }
  /*
   * 0.7, not 0.5. A disabled control is exempt from the contrast rule, but exempt is not the same as
   * unreadable: the required capabilities on the HR switchboard are permanently disabled, and at 0.5
   * their labels were 2.8:1 — a list nobody could read, describing what the workspace has turned on.
   * 0.7 is the point where ink-700 still clears 4.5:1 on the palest surface, and it is far enough
   * from full strength to still read as off.
   */
  .kcb.disabled { opacity: 0.7; cursor: not-allowed; }
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
