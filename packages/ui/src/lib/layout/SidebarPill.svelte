<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements'
import { cn } from '../utils.js'

/** Project pill header in sidebar ("YOUR PROJECTS"): 26px, #EFEBE1, colour square + mono label. */
interface Props extends HTMLAttributes<HTMLElement> {
  label: string
  color?: string
  href?: string
  active?: boolean
  class?: string
}
let { label, color = '#8E8779', href, active = false, class: className, ...rest }: Props = $props()
</script>
<svelte:element this={href ? 'a' : 'button'} {href} type={href ? undefined : 'button'} class={cn('kspill', active && 'active', className)} {...rest}>
  <span class="sq" style:background={color}></span><span class="l">{label}</span>
</svelte:element>
<style>
  .kspill { display: inline-flex; align-items: center; gap: 8px; height: 26px; margin: 6px 0 3px; padding: 0 9px; border-radius: var(--kern-r-md2); background: var(--kern-surface-chip); color: var(--kern-ink-400); text-decoration: none; }
  .kspill.active { background: var(--kern-ink-900); color: var(--kern-ink-inverse); }
  .sq { width: 13px; height: 13px; border-radius: var(--kern-r-xs); }
  .l { font-family: var(--kern-font-mono); font-size: 11px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
