<script lang="ts">
import type { LucideProps } from '@lucide/svelte'
import { getIcon } from './registry.js'

interface Props extends Omit<LucideProps, 'size'> {
  name: string
  size?: number | string
  strokeWidth?: number | string
}
let { name, size = 16, strokeWidth = 1.5, class: className, ...rest }: Props = $props()
const Cmp = $derived(getIcon(name))
</script>

{#if Cmp}
  <Cmp {size} stroke-width={strokeWidth} class={className} aria-hidden="true" {...rest} />
{:else}
  <!-- unknown icon: neutral placeholder square so layout never shifts -->
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" /></svg>
{/if}
