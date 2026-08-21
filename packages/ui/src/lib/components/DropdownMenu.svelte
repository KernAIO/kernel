<script lang="ts">
import { DropdownMenu as P } from 'bits-ui'
import type { Snippet } from 'svelte'
import MenuItems from './MenuItems.svelte'
import type { MenuItem } from './menu-types.js'

interface Props {
  items: MenuItem[]
  open?: boolean
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
  /** trigger markup; receives bits-ui trigger props to spread */
  trigger: Snippet<[Record<string, unknown>]>
  /** custom content header (e.g. user card) */
  header?: Snippet
  class?: string
  onOpenChange?: (o: boolean) => void
}
let {
  items,
  open = $bindable(false),
  align = 'end',
  side = 'bottom',
  sideOffset = 6,
  trigger,
  header,
  class: className,
  onOpenChange,
}: Props = $props()
</script>

<P.Root bind:open {onOpenChange}>
  <P.Trigger>
    {#snippet child({ props })}{@render trigger(props)}{/snippet}
  </P.Trigger>
  <P.Portal>
    <P.Content class="kmenu {className ?? ''}" {align} {side} {sideOffset} collisionPadding={8}>
      {#if header}<div class="kmenu-header">{@render header()}</div>{/if}
      <MenuItems {P} {items} />
    </P.Content>
  </P.Portal>
</P.Root>

<style>
  :global(.kmenu-header) { padding: 8px 9px 10px; border-bottom: 1px solid var(--kern-border-hairline); margin-bottom: 5px; }
</style>
