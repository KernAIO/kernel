<script lang="ts">
import Icon from '../icons/Icon.svelte'
import { cn } from '../utils.js'

/** Mobile bottom tab (≤768px). */
interface Props {
  label: string
  icon: string
  href?: string
  active?: boolean
  dot?: boolean
  onclick?: (e: MouseEvent) => void
  class?: string
}
let { label, icon, href, active = false, dot = false, onclick, class: className }: Props = $props()
</script>
<svelte:element this={href ? 'a' : 'button'} {href} type={href ? undefined : 'button'} role={href ? 'link' : 'button'} class={cn('kbt', active && 'active', className)} aria-current={active ? 'page' : undefined} {onclick}>
  <span class="ic"><Icon name={icon} size={20} strokeWidth={1.5} />{#if dot}<span class="dot"></span>{/if}</span>
  <span class="l">{label}</span>
</svelte:element>
<style>
  .kbt { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; color: var(--kern-ink-330); text-decoration: none; font-size: 10.5px; min-width: 0; padding: 6px 2px; }
  .kbt.active { color: var(--kern-ink-900); }
  .ic { position: relative; display: inline-grid; place-items: center; width: 36px; height: 28px; border-radius: var(--kern-r-lg); }
  .kbt.active .ic { background: var(--kern-ink-900); color: var(--kern-ink-inverse); }
  .dot { position: absolute; top: 2px; inset-inline-end: 4px; width: 6px; height: 6px; border-radius: 999px; background: var(--kern-danger); box-shadow: 0 0 0 2px var(--kern-shell); }
  .l { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; letter-spacing: -0.005em; }
</style>
