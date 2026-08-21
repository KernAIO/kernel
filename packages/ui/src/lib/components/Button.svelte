<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements'
import Icon from '../icons/Icon.svelte'
import { cn } from '../utils.js'

export type ButtonVariant = 'primary' | 'secondary' | 'white' | 'ghost' | 'danger' | 'link'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

type Base = {
  variant?: ButtonVariant
  size?: ButtonSize
  /** lucide icon name rendered before the label */
  icon?: string
  /** icon after the label */
  iconEnd?: string
  loading?: boolean
  /** full width */
  block?: boolean
  /** sidebar CTA radius (9px) instead of the default 6px */
  rounded?: 'md' | 'xl'
  class?: string
  children?: Snippet
  ref?: HTMLElement | null
}
type Props =
  | (Base & ({ href: string } & HTMLAnchorAttributes))
  | (Base & { href?: undefined } & HTMLButtonAttributes)

let {
  variant = 'primary',
  size = 'md',
  icon,
  iconEnd,
  loading = false,
  block = false,
  rounded = 'md',
  class: className,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props()

const iconSize = $derived(size === 'xs' ? 12 : size === 'sm' ? 13 : 14)
const cls = $derived(
  cn('kbtn', `v-${variant}`, `s-${size}`, `r-${rounded}`, block && 'block', loading && 'loading', className),
)
</script>

{#if 'href' in rest && rest.href}
  <a bind:this={ref} class={cls} aria-busy={loading || undefined} {...rest as HTMLAnchorAttributes}>
    {#if loading}<Icon name="loader" size={iconSize} class="spin" />{:else if icon}<Icon name={icon} size={iconSize} strokeWidth={1.9} />{/if}
    {#if children}<span class="label">{@render children()}</span>{/if}
    {#if iconEnd}<Icon name={iconEnd} size={iconSize} strokeWidth={1.7} />{/if}
  </a>
{:else}
  <button bind:this={ref} type="button" class={cls} aria-busy={loading || undefined} disabled={loading || (rest as HTMLButtonAttributes).disabled} {...rest as HTMLButtonAttributes}>
    {#if loading}<Icon name="loader" size={iconSize} class="spin" />{:else if icon}<Icon name={icon} size={iconSize} strokeWidth={1.9} />{/if}
    {#if children}<span class="label">{@render children()}</span>{/if}
    {#if iconEnd}<Icon name={iconEnd} size={iconSize} strokeWidth={1.7} />{/if}
  </button>
{/if}

<style>
  .kbtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    height: 32px;
    padding: 0 12px;
    border-radius: var(--kern-r-md);
    font-size: 13.5px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
    border: 1px solid transparent;
    cursor: pointer;
    user-select: none;
    text-decoration: none;
    transition: background-color var(--kern-dur-fast);
    flex: none;
  }
  .kbtn:disabled,
  .kbtn[aria-disabled='true'] {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .block { width: 100%; }
  .r-xl { border-radius: var(--kern-r-xl); }
  .s-xs { height: 26px; padding: 0 11px; font-size: 12.5px; gap: 6px; }
  .s-sm { height: 28px; padding: 0 11px; font-size: 12.5px; gap: 6px; }
  .s-md { height: 32px; padding: 0 12px; }
  .s-lg { height: 34px; padding: 0 14px; gap: 8px; }

  .v-primary { background: var(--kern-ink-900); color: var(--kern-ink-inverse); }
  .v-primary:hover:not(:disabled) { background: var(--kern-ink-hover); }
  .v-secondary { border-color: var(--kern-border-strong); background: var(--kern-btn-secondary-bg); color: var(--kern-ink-650); }
  .v-secondary:hover:not(:disabled) { background: var(--kern-btn-secondary-hover); }
  .v-white { border-color: var(--kern-border-strong); background: var(--kern-surface-raised); color: var(--kern-ink-600); }
  .v-white:hover:not(:disabled) { background: var(--kern-surface-hover); }
  .v-ghost { color: var(--kern-ink-550); }
  .v-ghost:hover:not(:disabled) { background: var(--kern-surface-hover); color: var(--kern-ink-900); }
  .v-danger { background: var(--kern-danger); color: #fff; }
  .v-danger:hover:not(:disabled) { filter: brightness(0.92); }
  .v-link { color: var(--kern-accent-text); padding: 0; height: auto; font-weight: 400; font-size: 13px; }
  .v-link:hover:not(:disabled) { color: var(--kern-accent-deep); text-decoration: underline; }
  .label { display: inline-flex; align-items: center; }
  :global(.kbtn .spin) { animation: kspin 0.8s linear infinite; }
  @keyframes kspin { to { transform: rotate(360deg); } }
</style>
