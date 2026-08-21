<script lang="ts">
import type { Snippet } from 'svelte'
import Icon from '../icons/Icon.svelte'
import { cn } from '../utils.js'

interface Props {
  title: string
  description?: string
  icon?: string /** bordered dashed box (default) or bare */
  bare?: boolean
  compact?: boolean
  class?: string
  actions?: Snippet
}
let { title, description, icon, bare = false, compact = false, class: className, actions }: Props = $props()
</script>

<div class={cn('kempty', bare && 'bare', compact && 'compact', className)}>
  {#if icon}<span class="ic"><Icon name={icon} size={compact ? 18 : 22} strokeWidth={1.4} /></span>{/if}
  <span class="kern-sublabel">{title}</span>
  {#if description}<p class="d">{description}</p>{/if}
  {#if actions}<div class="a">{@render actions()}</div>{/if}
</div>

<style>
  .kempty { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; padding: 36px 20px; border: 1px dashed var(--kern-border-muted); border-radius: var(--kern-r-2xl); color: var(--kern-ink-350); }
  .kempty.bare { border: 0; }
  .kempty.compact { padding: 20px 16px; gap: 6px; }
  .ic { color: var(--kern-ink-250); }
  .d { margin: 0; font-size: 13.5px; color: var(--kern-ink-350); max-width: 360px; text-wrap: pretty; line-height: 1.5; }
  .a { margin-top: 6px; display: flex; gap: 8px; }
</style>
