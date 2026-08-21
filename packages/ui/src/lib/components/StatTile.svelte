<script lang="ts">
import type { Snippet } from 'svelte'
import { cn } from '../utils.js'

interface Props {
  label: string
  value: string | number
  delta?: string | null
  note?: string | null
  size?: 'lg' | 'md'
  class?: string
  children?: Snippet
  href?: string
}
let {
  label,
  value,
  delta = null,
  note = null,
  size = 'lg',
  class: className,
  children,
  href,
}: Props = $props()
</script>

<svelte:element this={href ? 'a' : 'div'} {href} class={cn('kstat', `s-${size}`, href && 'link', className)}>
  <div class="l">{label}</div>
  <div class="row"><span class="v">{value}</span>{#if delta}<span class="dl">{delta}</span>{/if}</div>
  {#if note}<div class="n">{note}</div>{/if}
  {@render children?.()}
</svelte:element>

<style>
  .kstat { display: block; background: var(--kern-surface-raised); border: 1px solid var(--kern-border); border-radius: var(--kern-r-2xl); padding: 14px 16px; min-width: 0; color: inherit; text-decoration: none; }
  .kstat.link:hover { background: var(--kern-surface-card-hover); }
  .l { font-size: 12px; color: var(--kern-ink-450); }
  .row { display: flex; align-items: baseline; gap: 8px; margin-top: 10px; }
  .v { font-size: 28px; font-weight: 600; letter-spacing: -0.03em; line-height: 1; color: var(--kern-ink-900); }
  .s-md .v { font-size: 26px; }
  .dl { font-size: 12.5px; color: var(--kern-success-chip); }
  .n { font-size: 12.5px; color: var(--kern-ink-350); margin-top: 8px; }
</style>
