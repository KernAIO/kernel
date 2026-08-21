<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLAttributes } from 'svelte/elements'
import Avatar from '../components/Avatar.svelte'
import Badge from '../components/Badge.svelte'
import Icon from '../icons/Icon.svelte'
import { cn } from '../utils.js'

/**
 * 34px nav item. Variants: icon (16px lucide), colour square (14×14 r4), DM avatar (18px).
 * Badge: count (#E9E5DB) or glow (danger). Sub-items indent 22px.
 */
interface Props extends HTMLAttributes<HTMLElement> {
  label: string
  href?: string
  icon?: string
  color?: string
  avatar?: { id?: string | null; name?: string | null; src?: string | null }
  active?: boolean
  badge?: number | string | null
  glow?: boolean
  indent?: 0 | 1 | 2
  presence?: 'online' | 'away' | 'dnd' | 'offline' | null
  trailing?: Snippet
  class?: string
}
let {
  label,
  href,
  icon,
  color,
  avatar,
  active = false,
  badge = null,
  glow = false,
  indent = 0,
  presence = null,
  trailing,
  class: className,
  ...rest
}: Props = $props()
const tag = $derived(href ? 'a' : 'button')
</script>

<svelte:element this={tag} {href} type={tag === 'button' ? 'button' : undefined} class={cn('ksi', active && 'active', className)} style:padding-inline-start="{10 + indent * 22}px" aria-current={active ? 'page' : undefined} title={label} {...rest}>
  <span class="ic">
    {#if avatar}<Avatar id={avatar.id} name={avatar.name} src={avatar.src} size={18} />
    {:else if color}<span class="sq" style:background={color}></span>
    {:else if icon}<Icon name={icon} size={16} strokeWidth={1.5} />{/if}
  </span>
  <span class="l">{label}</span>
  {#if presence}<span class="pr p-{presence}"></span>{/if}
  {#if trailing}{@render trailing()}{/if}
  {#if badge !== null && badge !== undefined && badge !== 0}<Badge variant={glow ? 'glow' : 'count'}>{badge}</Badge>{/if}
</svelte:element>

<style>
  .ksi { display: flex; align-items: center; gap: 10px; height: 34px; padding-inline-end: 10px; border-radius: var(--kern-r-xl); font-size: 13.5px; color: var(--kern-ink-650); text-decoration: none; width: 100%; text-align: start; min-width: 0; }
  .ksi:hover { background: var(--kern-border); }
  .ksi.active, .ksi.active:hover { background: var(--kern-ink-900); color: var(--kern-ink-inverse); }
  .ic { width: 16px; height: 16px; display: inline-grid; place-items: center; color: var(--kern-ink-330); flex: none; }
  .ksi.active .ic { color: var(--kern-ink-inverse); }
  .sq { width: 14px; height: 14px; border-radius: var(--kern-r-xs); }
  .l { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.005em; }
  .ksi.active .l { font-weight: 600; }
  .pr { width: 7px; height: 7px; border-radius: 999px; background: var(--kern-success); flex: none; }
  .pr.p-offline { opacity: 0; }
  .pr.p-away { background: var(--kern-warning); }
  .pr.p-dnd { background: var(--kern-danger); }
</style>
