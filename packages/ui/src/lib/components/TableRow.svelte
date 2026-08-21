<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLAttributes } from 'svelte/elements'
import { cn } from '../utils.js'

interface Props extends HTMLAttributes<HTMLElement> {
  href?: string
  class?: string
  children: Snippet
}
let { href, class: className, children, ...rest }: Props = $props()
const tag = $derived(href ? 'a' : rest.onclick ? 'button' : 'div')
</script>
<svelte:element this={tag} {href} type={tag === 'button' ? 'button' : undefined} class={cn('ktr', (href || rest.onclick) && 'clickable', className)} role="row" {...rest}>{@render children()}</svelte:element>
