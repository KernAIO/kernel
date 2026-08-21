<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLAttributes } from 'svelte/elements'
import { cn } from '../utils.js'

/** Thin wrapper: native scrolling with the Kern scrollbar styles (from tokens.css). */
interface Props extends HTMLAttributes<HTMLDivElement> {
  axis?: 'y' | 'x' | 'both'
  class?: string
  children: Snippet
  ref?: HTMLDivElement | null
}
let { axis = 'y', class: className, children, ref = $bindable(null), ...rest }: Props = $props()
</script>
<div bind:this={ref} class={cn('ksa', `a-${axis}`, className)} {...rest}>{@render children()}</div>
<style>
  .ksa { min-width: 0; min-height: 0; }
  .a-y { overflow-y: auto; overflow-x: hidden; }
  .a-x { overflow-x: auto; overflow-y: hidden; }
  .a-both { overflow: auto; }
</style>
