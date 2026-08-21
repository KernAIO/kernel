<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLButtonAttributes } from 'svelte/elements'
import Icon from '../icons/Icon.svelte'
import { cn } from '../utils.js'

interface Props extends HTMLButtonAttributes {
  /** lucide icon name (or pass children for a custom svg) */
  icon?: string
  /** accessible name (required) */
  label: string
  /** square size in px */
  size?: 22 | 26 | 28 | 30 | 32 | 34
  iconSize?: number
  strokeWidth?: number
  /** ghost (content area), sidebar (shell hover colour), outline (bordered, e.g. cmd-K), primary, secondary */
  variant?: 'ghost' | 'sidebar' | 'outline' | 'primary' | 'secondary'
  active?: boolean
  radius?: 5 | 6 | 8 | 9
  class?: string
  children?: Snippet
  ref?: HTMLButtonElement | null
}
let {
  icon,
  label,
  size = 28,
  iconSize,
  strokeWidth = 1.6,
  variant = 'ghost',
  active = false,
  radius = 6,
  class: className,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props()
const isz = $derived(iconSize ?? (size >= 32 ? 16 : size >= 28 ? 15 : 14))
</script>

<button
  bind:this={ref}
  type="button"
  class={cn('kib', `v-${variant}`, active && 'active', className)}
  style:--s="{size}px"
  style:--r="{radius}px"
  aria-label={label}
  title={rest.title ?? label}
  aria-pressed={active || undefined}
  {...rest}
>
  {#if children}{@render children()}{:else if icon}<Icon name={icon} size={isz} strokeWidth={strokeWidth} />{/if}
</button>

<style>
  .kib {
    width: var(--s);
    height: var(--s);
    border-radius: var(--r);
    display: inline-grid;
    place-items: center;
    color: var(--kern-ink-400);
    border: 1px solid transparent;
    flex: none;
    transition: background-color var(--kern-dur-fast);
  }
  .kib:disabled { opacity: 0.45; cursor: not-allowed; }
  .v-ghost:hover:not(:disabled) { background: var(--kern-surface-hover); color: var(--kern-ink-900); }
  .v-sidebar:hover:not(:disabled) { background: var(--kern-border); color: var(--kern-ink-700); }
  .v-outline { border-color: var(--kern-border-strong); }
  .v-outline:hover:not(:disabled) { background: var(--kern-surface-active); color: var(--kern-ink-900); }
  .v-primary { background: var(--kern-ink-900); color: var(--kern-ink-inverse); }
  .v-primary:hover:not(:disabled) { background: var(--kern-ink-hover); }
  .v-secondary { border-color: var(--kern-border-strong); background: var(--kern-btn-secondary-bg); color: var(--kern-ink-500); }
  .v-secondary:hover:not(:disabled) { background: var(--kern-btn-secondary-hover); }
  .active, .active:hover { background: var(--kern-ink-900) !important; color: var(--kern-ink-inverse) !important; }
</style>
