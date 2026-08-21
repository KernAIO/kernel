<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLButtonAttributes } from 'svelte/elements'
import Icon from '../icons/Icon.svelte'
import { cn } from '../utils.js'

/** 30px ghost toolbar button ("Filter", "by Status") with optional mono prefix; `active` = accent-tint chip. */
interface Props extends HTMLButtonAttributes {
  icon?: string
  prefix?: string
  active?: boolean
  onClear?: () => void
  class?: string
  children?: Snippet
}
let { icon, prefix, active = false, onClear, class: className, children, ...rest }: Props = $props()
</script>

<button type="button" class={cn('ktbb', active && 'active', className)} {...rest}>
  {#if icon}<Icon name={icon} size={14} strokeWidth={1.6} />{/if}
  {#if prefix}<span class="pre">{prefix}</span>{/if}
  <span>{@render children?.()}</span>
  {#if active && onClear}<span role="button" tabindex="-1" class="x" aria-label="Clear" onclick={(e) => { e.stopPropagation(); onClear() }} onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onClear() } }}><Icon name="x" size={12} strokeWidth={2} /></span>{/if}
</button>

<style>
  .ktbb { display: inline-flex; align-items: center; gap: 7px; height: 30px; padding: 0 11px; border-radius: var(--kern-r-lg); font-size: 13px; color: var(--kern-ink-550); white-space: nowrap; }
  .ktbb:hover { background: var(--kern-surface-hover); }
  .ktbb.active { background: var(--kern-accent-tint); color: var(--kern-accent-deep); font-weight: 500; padding-inline: 11px 8px; gap: 8px; }
  .pre { font-family: var(--kern-font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--kern-ink-250); }
  .x { opacity: 0.6; display: inline-grid; place-items: center; }
  .x:hover { opacity: 1; }
</style>
