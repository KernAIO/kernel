<script lang="ts">
import { cn } from '../utils.js'

interface Props {
  orientation?: 'horizontal' | 'vertical' /** hairline = list divider colour */
  hairline?: boolean
  class?: string
  decorative?: boolean
}
let { orientation = 'horizontal', hairline = false, class: className, decorative = true }: Props = $props()
</script>

<div role={decorative ? 'none' : 'separator'} aria-orientation={decorative ? undefined : orientation} class={cn('ksep', orientation, hairline && 'hair', className)}></div>

<style>
  .ksep { background: var(--kern-border); flex: none; }
  .ksep.hair { background: var(--kern-border-hairline); }
  .horizontal { height: 1px; width: 100%; }
  .vertical { width: 1px; height: 18px; align-self: center; }
</style>
