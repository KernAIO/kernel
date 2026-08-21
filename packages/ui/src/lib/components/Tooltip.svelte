<script lang="ts">
import { Tooltip as P } from 'bits-ui'
import type { Snippet } from 'svelte'
import Kbd from './Kbd.svelte'

interface Props {
  text?: string
  keys?: string[]
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  delay?: number
  disabled?: boolean
  children: Snippet<[Record<string, unknown>]>
  content?: Snippet
}
let {
  text,
  keys,
  side = 'bottom',
  align = 'center',
  delay = 400,
  disabled = false,
  children,
  content,
}: Props = $props()
</script>

<P.Root delayDuration={delay} {disabled}>
  <P.Trigger>{#snippet child({ props })}{@render children(props)}{/snippet}</P.Trigger>
  <P.Portal>
    <P.Content class="ktip" {side} {align} sideOffset={6} collisionPadding={8}>
      {#if content}{@render content()}{:else}{text}{#if keys}<Kbd {keys} class="ktip-kbd" />{/if}{/if}
    </P.Content>
  </P.Portal>
</P.Root>

<style>
  :global(.ktip) { display: inline-flex; align-items: center; gap: 8px; background: var(--kern-ink-900); color: var(--kern-ink-inverse); font-size: 12px; padding: 5px 8px; border-radius: var(--kern-r-md); z-index: 80; animation: kfade 0.1s ease-out; max-width: 260px; line-height: 1.35; pointer-events: none; }
  :global(.ktip-kbd) { color: inherit; opacity: 0.6; }
</style>
