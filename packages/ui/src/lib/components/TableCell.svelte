<script lang="ts">
import type { Snippet } from 'svelte'
import { cn } from '../utils.js'

interface Props {
  class?: string
  end?: boolean
  header?: boolean
  children?: Snippet
}
let { class: className, end = false, header = false, children }: Props = $props()
</script>
<div class={cn('ktd', end && 'end', className)} role={header ? 'columnheader' : 'cell'}>{@render children?.()}</div>
