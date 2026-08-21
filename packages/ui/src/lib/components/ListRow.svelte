<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLAttributes } from 'svelte/elements'
import { cn } from '../utils.js'

/**
 * Dense list row with issue-row anatomy slots: leading (glyph), key, status, title (flex), meta cells, trailing.
 * Renders as <a>/<button>/<div> depending on href/onclick.
 */
interface Props extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  href?: string
  selected?: boolean
  height?: number
  /** hover bg: 'raised' (#FFF, on surface) or 'shell' (#F0EDE4, on shell panes) */
  hover?: 'raised' | 'shell' | 'none'
  hairline?: boolean
  class?: string
  leading?: Snippet
  keyText?: string
  status?: Snippet
  title?: Snippet
  subtitle?: Snippet
  meta?: Snippet
  trailing?: Snippet
  children?: Snippet
}
let {
  href,
  selected = false,
  height = 40,
  hover = 'raised',
  hairline = true,
  class: className,
  leading,
  keyText,
  status,
  title,
  subtitle,
  meta,
  trailing,
  children,
  ...rest
}: Props = $props()
const tag = $derived(href ? 'a' : rest.onclick ? 'button' : 'div')
</script>

<svelte:element this={tag} {href} type={tag === 'button' ? 'button' : undefined} class={cn('krow', `h-${hover}`, selected && 'sel', hairline && 'hair', className)} style:min-height="{height}px" aria-current={selected ? 'true' : undefined} {...rest}>
  {#if children}
    {@render children()}
  {:else}
    {#if leading}<span class="c lead">{@render leading()}</span>{/if}
    {#if keyText}<span class="c key kern-ltr">{keyText}</span>{/if}
    {#if status}<span class="c st">{@render status()}</span>{/if}
    <span class="c main">
      {#if title}<span class="t">{@render title()}</span>{/if}
      {#if subtitle}<span class="s">{@render subtitle()}</span>{/if}
    </span>
    {#if meta}<span class="c meta">{@render meta()}</span>{/if}
    {#if trailing}<span class="c tr">{@render trailing()}</span>{/if}
  {/if}
</svelte:element>

<style>
  .krow { display: flex; align-items: center; gap: 10px; width: 100%; padding: 0 16px; text-align: start; color: inherit; text-decoration: none; box-sizing: border-box; cursor: pointer; background: transparent; border-radius: 0; }
  .krow.hair { border-bottom: 1px solid var(--kern-border-hairline); }
  .h-raised:hover { background: var(--kern-surface-raised); }
  .h-shell:hover { background: var(--kern-surface-hover); }
  .sel, .sel:hover { background: var(--kern-accent-tint); }
  .c { display: inline-flex; align-items: center; gap: 6px; flex: none; min-width: 0; }
  .lead { width: 18px; justify-content: center; }
  .key { width: 62px; font-size: 13px; color: var(--kern-ink-350); }
  .st { width: 18px; justify-content: center; }
  .main { flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; overflow: hidden; }
  .t { font-size: 14px; color: var(--kern-ink-800); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .s { font-size: 12.5px; color: var(--kern-ink-350); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .meta { gap: 10px; font-size: 12.5px; color: var(--kern-ink-350); }
  .tr { gap: 8px; }
</style>
