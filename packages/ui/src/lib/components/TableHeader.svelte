<script lang="ts">
import type { Snippet } from 'svelte'
import { cn } from '../utils.js'

interface Props {
  class?: string
  children: Snippet
}
let { class: className, children }: Props = $props()
</script>
<div class={cn('kth', className)} role="row">{@render children()}</div>
