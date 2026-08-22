<script lang="ts">
import Icon from '../icons/Icon.svelte'
import Kbd from './Kbd.svelte'
import MenuItems from './MenuItems.svelte'
import type { MenuItem } from './menu-types.js'

interface Props {
  // biome-ignore lint/suspicious/noExplicitAny: primitive namespace (bits-ui DropdownMenu | ContextMenu)
  P: any
  items: MenuItem[]
}
let { P, items }: Props = $props()
const Item = $derived(P.Item)
const Separator = $derived(P.Separator)
const Group = $derived(P.Group)
const GroupHeading = $derived(P.GroupHeading)
const CheckboxItem = $derived(P.CheckboxItem)
const RadioGroup = $derived(P.RadioGroup)
const RadioItem = $derived(P.RadioItem)
const Sub = $derived(P.Sub)
const SubTrigger = $derived(P.SubTrigger)
const SubContent = $derived(P.SubContent)
</script>

{#each items as it, i (('id' in it && it.id) || i)}
  {#if it.type === 'separator'}
    <Separator class="kmenu-sep" />
  {:else if it.type === 'label'}
    <Group><GroupHeading class="kmenu-label">{it.label}</GroupHeading></Group>
  {:else if it.type === 'checkbox'}
    <CheckboxItem class="kmenu-item" checked={it.checked} onCheckedChange={it.onCheckedChange} disabled={it.disabled}>
      {#snippet children({ checked }: { checked: boolean })}
        <span class="kmenu-ic">{#if checked}<Icon name="check" size={14} strokeWidth={2} />{/if}</span>
        <span class="kmenu-l">{it.label}</span>
      {/snippet}
    </CheckboxItem>
  {:else if it.type === 'radio'}
    <RadioGroup value={it.value} onValueChange={it.onValueChange}>
      {#each it.options as o (o.value)}
        <RadioItem class="kmenu-item" value={o.value}>
          {#snippet children({ checked }: { checked: boolean })}
            <span class="kmenu-ic">{#if checked}<Icon name="check" size={14} strokeWidth={2} />{:else if o.icon}<Icon name={o.icon} size={15} strokeWidth={1.6} />{/if}</span>
            <span class="kmenu-l">{o.label}</span>
          {/snippet}
        </RadioItem>
      {/each}
    </RadioGroup>
  {:else if it.children?.length}
    <Sub>
      <SubTrigger class="kmenu-item">
        <span class="kmenu-ic">{#if it.icon}<Icon name={it.icon} size={15} strokeWidth={1.6} />{/if}</span>
        <span class="kmenu-l">{it.label}</span>
        <Icon name="chevron-right" size={13} class="kmenu-chev" />
      </SubTrigger>
      <SubContent class="kmenu" sideOffset={4}><MenuItems {P} items={it.children} /></SubContent>
    </Sub>
  {:else}
    <Item class="kmenu-item {it.danger ? 'danger' : ''}" disabled={it.disabled} onSelect={() => { if (it.href && typeof window !== 'undefined') window.location.assign(it.href); it.onSelect?.() }}>
      <span class="kmenu-ic">{#if it.icon}<Icon name={it.icon} size={15} strokeWidth={1.6} />{/if}</span>
      <span class="kmenu-l">{it.label}</span>
      {#if it.shortcut}<Kbd keys={it.shortcut} />{:else if it.hint}<span class="kmenu-hint">{it.hint}</span>{/if}
    </Item>
  {/if}
{/each}

<style>
  :global(.kmenu) {
    min-width: 180px; max-width: 320px; padding: 5px;
    background: var(--kern-surface-raised); border: 1px solid var(--kern-border);
    border-radius: var(--kern-r-2xl); box-shadow: var(--kern-shadow-popover);
    z-index: 60; outline: none; animation: kfade 0.12s ease-out;
    max-height: var(--bits-dropdown-menu-content-available-height, var(--bits-context-menu-content-available-height, 70vh)); overflow-y: auto;
  }
  :global(.kmenu-item) {
    display: flex; align-items: center; gap: 9px; height: 34px; padding: 0 9px; border-radius: var(--kern-r-md2);
    font-size: 13.5px; color: var(--kern-ink-800); cursor: pointer; user-select: none; outline: none; text-decoration: none;
  }
  :global(.kmenu-item[data-highlighted]), :global(.kmenu-item:hover) { background: var(--kern-surface-popover-hover); }
  :global(.kmenu-item[data-disabled]) { opacity: 0.45; cursor: not-allowed; }
  :global(.kmenu-item.danger) { color: var(--kern-danger); }
  :global(.kmenu-ic) { width: 16px; display: inline-grid; place-items: center; color: var(--kern-ink-400); flex: none; }
  :global(.kmenu-item.danger .kmenu-ic) { color: inherit; }
  :global(.kmenu-l) { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  :global(.kmenu-l) { flex: 1 1 auto; min-width: 0; white-space: nowrap; }
  /* the hint explains why an item is unavailable; it yields to the label rather than truncating it */
  :global(.kmenu-hint) {
    font-size: 12px; color: var(--kern-ink-250);
    flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  /* an item carrying a hint may wrap onto two lines rather than squeeze both onto one */
  :global(.kmenu-item:has(.kmenu-hint)) { height: auto; min-height: 34px; padding-block: 5px; flex-wrap: wrap; }
  :global(.kmenu-item:has(.kmenu-hint) .kmenu-hint) { flex-basis: 100%; padding-inline-start: 24px; }
  :global(.kmenu-chev) { color: var(--kern-ink-250); }
  :global([dir='rtl'] .kmenu-chev) { transform: scaleX(-1); }
  :global(.kmenu-sep) { height: 1px; background: var(--kern-border-hairline); margin: 5px 4px; }
  :global(.kmenu-label) { padding: 6px 9px 4px; font-family: var(--kern-font-mono); font-size: 10.5px; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase; color: var(--kern-ink-300); }
</style>
