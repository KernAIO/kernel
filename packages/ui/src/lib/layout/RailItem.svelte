<script lang="ts">
import type { Snippet } from 'svelte'
import Tooltip from '../components/Tooltip.svelte'
import Icon from '../icons/Icon.svelte'
import { cn } from '../utils.js'

/** 34×34 r9 rail button with optional 6px danger dot (DESIGN.md §2.2). */
interface Props {
  label: string
  icon?: string
  href?: string
  active?: boolean
  dot?: boolean
  badge?: number | null
  muted?: boolean
  keys?: string[]
  class?: string
  onclick?: (e: MouseEvent) => void
  children?: Snippet
}
let {
  label,
  icon,
  href,
  active = false,
  dot = false,
  badge = null,
  muted = false,
  keys,
  class: className,
  onclick,
  children: inner,
}: Props = $props()
</script>

<Tooltip text={label} {keys} side="right">
  {#snippet children(props)}
    <svelte:element this={href ? 'a' : 'button'} {href} type={href ? undefined : 'button'} class={cn('krit', active && 'active', muted && 'muted', className)} aria-label={label} aria-current={active ? 'page' : undefined} {onclick} {...props}>
      {#if inner}{@render inner()}{:else if icon}<Icon name={icon} size={18} strokeWidth={1.5} />{/if}
      {#if dot}<span class="dot" aria-hidden="true"></span>{/if}
      {#if badge}<span class="bd">{badge > 99 ? '99+' : badge}</span>{/if}
    </svelte:element>
  {/snippet}
</Tooltip>

<style>
  .krit { position: relative; width: 34px; height: 34px; border-radius: var(--kern-r-xl); display: grid; place-items: center; color: var(--kern-ink-330); text-decoration: none; flex: none; }
  .krit:hover { background: var(--kern-border); color: var(--kern-ink-700); }
  .krit.muted { color: var(--kern-ink-350); }
  .krit.active, .krit.active:hover { background: var(--kern-ink-900); color: var(--kern-ink-inverse); }
  .dot { position: absolute; top: 4px; inset-inline-end: 4px; width: 6px; height: 6px; border-radius: 999px; background: var(--kern-danger); box-shadow: 0 0 0 2px var(--kern-shell); }
  .krit.active .dot { box-shadow: 0 0 0 2px var(--kern-ink-900); }
  .bd { position: absolute; top: -3px; inset-inline-end: -4px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px; background: var(--kern-danger); color: var(--kern-ink-inverse); font-family: var(--kern-font-mono); font-size: 9.5px; font-weight: 500; display: grid; place-items: center; box-shadow: 0 0 0 2px var(--kern-shell); line-height: 1; }
</style>
