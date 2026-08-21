<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLLabelAttributes } from 'svelte/elements'
import { cn } from '../utils.js'

interface Props extends HTMLLabelAttributes {
  required?: boolean
  hint?: string
  class?: string
  children?: Snippet
}
let { required = false, hint, class: className, children, ...rest }: Props = $props()
</script>

<label class={cn('klabel', className)} {...rest}>
  <span class="t">{@render children?.()}{#if required}<span class="req" aria-hidden="true">*</span>{/if}</span>
  {#if hint}<span class="h">{hint}</span>{/if}
</label>

<style>
  .klabel { display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: var(--kern-ink-650); font-weight: 500; }
  .req { color: var(--kern-danger); margin-inline-start: 3px; }
  .h { font-weight: 400; font-size: 12px; color: var(--kern-ink-350); }
</style>
