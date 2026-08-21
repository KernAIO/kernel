<script lang="ts">
import { cn } from '../utils.js'

interface Props {
  width?: string
  height?: string
  radius?: string
  class?: string
  lines?: number
}
let { width = '100%', height = '12px', radius = '5px', class: className, lines = 1 }: Props = $props()
</script>

{#if lines > 1}
  <div class={cn('ksk-stack', className)} aria-hidden="true">
    {#each Array.from({ length: lines }) as _, i}
      <div class="ksk" style:width={i === lines - 1 ? '60%' : width} style:height={height} style:border-radius={radius}></div>
    {/each}
  </div>
{:else}
  <div class={cn('ksk', className)} style:width style:height style:border-radius={radius} aria-hidden="true"></div>
{/if}

<style>
  .ksk { background: var(--kern-surface-active); animation: kpulse 1.4s ease-in-out infinite; }
  .ksk-stack { display: flex; flex-direction: column; gap: 8px; }
</style>
