<script lang="ts">
import { Popover as P } from 'bits-ui'
import type { Snippet } from 'svelte'
import { cn } from '../utils.js'

interface Props {
  open?: boolean
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
  width?: string
  /** trigger markup; receives bits-ui trigger props to spread */
  trigger?: Snippet<[Record<string, unknown>]>
  /** header strip (#F3F0E8) */
  title?: string
  headerActions?: Snippet
  children: Snippet
  class?: string
  contentClass?: string
  onOpenChange?: (o: boolean) => void
  /** anchor to a custom element instead of the trigger */
  customAnchor?: HTMLElement | string | null
}
let {
  open = $bindable(false),
  align = 'end',
  side = 'bottom',
  sideOffset = 6,
  width = '340px',
  trigger,
  title,
  headerActions,
  children,
  class: className,
  contentClass,
  onOpenChange,
  customAnchor,
}: Props = $props()
</script>

<P.Root bind:open {onOpenChange}>
  {#if trigger}
    <P.Trigger>{#snippet child({ props })}{@render trigger(props)}{/snippet}</P.Trigger>
  {/if}
  <P.Portal>
    <P.Content class={cn('kpop', className)} {align} {side} {sideOffset} collisionPadding={8} style="width:{width}" {customAnchor}>
      {#if title}
        <div class="kpop-head"><span>{title}</span>{#if headerActions}<span class="acts">{@render headerActions()}</span>{/if}</div>
      {/if}
      <div class={cn('kpop-body', contentClass)}>{@render children()}</div>
    </P.Content>
  </P.Portal>
</P.Root>

<style>
  :global(.kpop) { background: var(--kern-surface-raised); border-radius: var(--kern-r-2xl); box-shadow: var(--kern-shadow-popover); border: 1px solid var(--kern-border); overflow: hidden; z-index: 60; outline: none; animation: kfade 0.12s ease-out; max-width: calc(100vw - 16px); }
  .kpop-head { display: flex; align-items: center; justify-content: space-between; height: 40px; padding: 0 14px; background: var(--kern-surface-popover-hover); font-size: 13px; font-weight: 500; color: var(--kern-ink-900); }
  .acts { display: inline-flex; gap: 4px; }
  .kpop-body { max-height: min(70vh, 560px); overflow-y: auto; }
</style>
