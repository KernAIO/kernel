<script lang="ts">
import Icon from '../icons/Icon.svelte'
import Avatar from './Avatar.svelte'
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
        {#if it.avatar}<Avatar id={it.avatar.id} name={it.avatar.name} src={it.avatar.src} size={20} />{/if}
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
      {#if it.avatar}<Avatar id={it.avatar.id} name={it.avatar.name} src={it.avatar.src} size={20} />{/if}
      <span class="kmenu-l">{it.label}</span>
      {#if it.shortcut}<Kbd keys={it.shortcut} />{:else if it.hint}<span class="kmenu-hint">{it.hint}</span>{/if}
    </Item>
  {/if}
{/each}
