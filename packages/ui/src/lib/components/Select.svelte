<script lang="ts">
import { Select as P } from 'bits-ui'
import Icon from '../icons/Icon.svelte'
import { cn } from '../utils.js'
export interface SelectOption {
  value: string
  label: string
  icon?: string
  description?: string
  disabled?: boolean
  group?: string
}
interface Props {
  value?: string
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  /** ghost trigger (toolbar style) */
  ghost?: boolean
  width?: string
  name?: string
  id?: string
  class?: string
  contentClass?: string
  onValueChange?: (v: string) => void
  allowDeselect?: boolean
}
let {
  value = $bindable(''),
  options,
  placeholder = 'Select…',
  disabled = false,
  size = 'md',
  ghost = false,
  width,
  name,
  id,
  class: className,
  contentClass,
  onValueChange,
  allowDeselect = false,
}: Props = $props()
const selected = $derived(options.find((o) => o.value === value))
const groups = $derived.by(() => {
  const m = new Map<string, SelectOption[]>()
  for (const o of options) {
    const g = o.group ?? ''
    if (!m.has(g)) m.set(g, [])
    m.get(g)!.push(o)
  }
  return [...m.entries()]
})
</script>

<P.Root type="single" bind:value {disabled} {name} {onValueChange} {allowDeselect} items={options.map((o) => ({ value: o.value, label: o.label, disabled: o.disabled }))}>
  <P.Trigger class={cn('ksel', `s-${size}`, ghost && 'ghost', !selected && 'placeholder', className)} style={width ? `width:${width}` : undefined} {id} aria-label={placeholder}>
    {#if selected?.icon}<Icon name={selected.icon} size={14} strokeWidth={1.7} class="ksel-ic" />{/if}
    <span class="ksel-l">{selected?.label ?? placeholder}</span>
    <Icon name="chevrons-up-down" size={13} strokeWidth={1.6} class="ksel-chev" />
  </P.Trigger>
  <P.Portal>
    <P.Content class={cn('kmenu ksel-content', contentClass)} sideOffset={4} collisionPadding={8}>
      <P.Viewport>
        {#each groups as [g, opts] (g)}
          {#if g}<P.GroupHeading class="kmenu-label">{g}</P.GroupHeading>{/if}
          {#each opts as o (o.value)}
            <P.Item value={o.value} label={o.label} disabled={o.disabled} class="kmenu-item ksel-item">
              {#snippet children({ selected })}
                <span class="kmenu-ic">{#if o.icon}<Icon name={o.icon} size={15} strokeWidth={1.6} />{/if}</span>
                <span class="kmenu-l"><span>{o.label}</span>{#if o.description}<span class="ksel-d">{o.description}</span>{/if}</span>
                {#if selected}<Icon name="check" size={14} strokeWidth={2} class="ksel-check" />{/if}
              {/snippet}
            </P.Item>
          {/each}
        {/each}
      </P.Viewport>
    </P.Content>
  </P.Portal>
</P.Root>

<style>
  :global(.ksel) {
    display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 10px 0 12px; min-width: 0; width: 100%;
    border: 1px solid var(--kern-border-strong); border-radius: var(--kern-r-lg); background: var(--kern-surface-raised);
    color: var(--kern-ink-800); font-size: 13.5px; text-align: start; cursor: pointer; transition: border-color var(--kern-dur-fast), box-shadow var(--kern-dur-fast);
  }
  :global(.ksel.s-sm) { height: 30px; font-size: 13px; border-radius: var(--kern-r-md2); }
  :global(.ksel.ghost) { border-color: transparent; background: transparent; color: var(--kern-ink-550); width: auto; }
  :global(.ksel.ghost:hover) { background: var(--kern-surface-hover); }
  :global(.ksel.placeholder) { color: var(--kern-ink-250); }
  :global(.ksel:focus-visible) { border-color: var(--kern-accent); box-shadow: 0 0 0 3px var(--kern-ring); }
  :global(.ksel[data-disabled]) { opacity: 0.5; cursor: not-allowed; }
  :global(.ksel-l) { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  :global(.ksel-ic) { color: var(--kern-ink-400); flex: none; }
  :global(.ksel-chev) { color: var(--kern-ink-250); flex: none; }
  :global(.ksel-content) { min-width: var(--bits-select-anchor-width); max-height: var(--bits-select-content-available-height, 320px); }
  :global(.ksel-item[data-selected]) { font-weight: 500; }
  :global(.ksel-check) { color: var(--kern-ink-900); flex: none; }
  :global(.ksel-d) { display: block; font-size: 12px; color: var(--kern-ink-350); white-space: normal; }
  :global(.ksel-content .kmenu-l) { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; }
</style>
