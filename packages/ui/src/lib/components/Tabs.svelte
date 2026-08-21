<script lang="ts">
import { Tabs as P } from 'bits-ui'
import type { Snippet } from 'svelte'
import Icon from '../icons/Icon.svelte'
import { cn } from '../utils.js'
export interface TabItem {
  value: string
  label: string
  icon?: string
  count?: number | string | null
  disabled?: boolean
  href?: string
}
/**
 * pill      — 24px pills (#E9E5DB active) for section filters (DESIGN.md §3.0)
 * underline — 2px underline inside a 52px toolbar (preset tabs, §2.5)
 * settings  — left nav style list is NOT this; use Sidebar nav.
 */
interface Props {
  items: TabItem[]
  value?: string
  variant?: 'pill' | 'underline'
  class?: string
  onValueChange?: (v: string) => void
  children?: Snippet<[string]>
  label?: string
}
let {
  items,
  value = $bindable(items[0]?.value ?? ''),
  variant = 'pill',
  class: className,
  onValueChange,
  children,
  label,
}: Props = $props()
</script>

<P.Root bind:value {onValueChange} class={cn('ktabs', `v-${variant}`, className)}>
  <P.List class="ktabs-list" aria-label={label}>
    {#each items as t (t.value)}
      <P.Trigger value={t.value} disabled={t.disabled} class="ktab">
        {#if t.icon}<Icon name={t.icon} size={13} strokeWidth={1.7} />{/if}
        <span>{t.label}</span>
        {#if t.count !== undefined && t.count !== null}<span class="cnt">{t.count}</span>{/if}
      </P.Trigger>
    {/each}
  </P.List>
  {#if children}
    {#each items as t (t.value)}<P.Content value={t.value} class="ktabs-content">{@render children(t.value)}</P.Content>{/each}
  {/if}
</P.Root>

<style>
  :global(.ktabs) { min-width: 0; }
  :global(.ktabs-list) { display: flex; align-items: center; gap: 4px; }
  :global(.ktab) { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; cursor: pointer; outline: none; }
  :global(.ktab:focus-visible) { box-shadow: 0 0 0 3px var(--kern-ring); }
  :global(.ktab[data-disabled]) { opacity: 0.45; cursor: not-allowed; }
  :global(.ktabs-content) { outline: none; }
  /* pill */
  :global(.v-pill .ktab) { height: 24px; padding: 0 9px; border-radius: var(--kern-r-md); font-size: 12.5px; color: var(--kern-ink-300); }
  :global(.v-pill .ktab:hover) { color: var(--kern-ink-700); }
  :global(.v-pill .ktab[data-state='active']) { background: var(--kern-surface-active); color: var(--kern-ink-900); font-weight: 600; }
  /* underline */
  :global(.v-underline .ktabs-list) { gap: 18px; height: 100%; align-items: stretch; }
  :global(.v-underline .ktab) { font-size: 13.5px; color: var(--kern-ink-350); border-bottom: 2px solid transparent; padding: 0 1px; margin-bottom: -1px; }
  :global(.v-underline .ktab:hover) { color: var(--kern-ink-700); }
  :global(.v-underline .ktab[data-state='active']) { color: var(--kern-ink-900); font-weight: 600; border-bottom-color: var(--kern-ink-900); }
  .cnt { font-family: var(--kern-font-mono); font-size: 11px; color: var(--kern-ink-250); font-weight: 400; }
</style>
