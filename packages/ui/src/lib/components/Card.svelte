<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLAttributes } from 'svelte/elements'
import { cn } from '../utils.js'

interface Props extends HTMLAttributes<HTMLElement> {
  href?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  radius?: 10 | 11
  hoverable?: boolean
  class?: string
  children: Snippet
}
let {
  href,
  padding = 'md',
  radius = 10,
  hoverable = false,
  class: className,
  children,
  ...rest
}: Props = $props()
</script>
<svelte:element this={href ? 'a' : 'div'} {href} class={cn('kcard', `p-${padding}`, (hoverable || href) && 'hov', className)} style:border-radius="{radius}px" {...rest}>{@render children()}</svelte:element>
<style>
  .kcard { display: block; background: var(--kern-surface-raised); border: 1px solid var(--kern-border); color: inherit; text-decoration: none; min-width: 0; }
  .p-sm { padding: 11px 12px; }
  .p-md { padding: 14px 16px; }
  .p-lg { padding: 16px 18px; }
  .hov:hover { background: var(--kern-surface-card-hover); }
</style>
