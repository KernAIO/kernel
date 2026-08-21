<script lang="ts">
import { ContextMenu as P } from 'bits-ui'
import type { Snippet } from 'svelte'
import MenuItems from './MenuItems.svelte'
import type { MenuItem } from './menu-types.js'

interface Props {
  items: MenuItem[]
  children: Snippet
  class?: string
  disabled?: boolean
}
let { items, children, class: className, disabled = false }: Props = $props()
</script>

<P.Root>
  <P.Trigger {disabled} class={className}>{@render children()}</P.Trigger>
  <P.Portal>
    <P.Content class="kmenu" collisionPadding={8}><MenuItems {P} {items} /></P.Content>
  </P.Portal>
</P.Root>
