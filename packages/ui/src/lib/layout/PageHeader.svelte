<script lang="ts">
import type { Snippet } from 'svelte'
import Breadcrumb from '../components/Breadcrumb.svelte'
import ProgressBar from '../components/ProgressBar.svelte'
import { cn } from '../utils.js'

/**
 * Content header (DESIGN.md §2.4): row 1 breadcrumb + search + actions; row 2 title + mono subtitle; row 3 measure or rule.
 * `measure` = 0–100 renders the 3px accent bar; otherwise a 1px rule.
 */
interface Props {
  crumbs?: { label: string; href?: string }[]
  title: string
  subtitle?: string | null
  measure?: number | null
  search?: Snippet
  actions?: Snippet
  titleActions?: Snippet
  compact?: boolean
  /** set the browser tab from `title`; turn it off where the page names its own tab */
  documentTitle?: boolean
  class?: string
  children?: Snippet
}
let {
  crumbs = [],
  title,
  subtitle = null,
  measure = null,
  search,
  actions,
  titleActions,
  compact = false,
  class: className,
  children,
  documentTitle = true,
}: Props = $props()
</script>

<!--
  The header carries the page's name, so it names the browser tab as well. Without this a module's
  screens all showed an empty tab — no history entry worth reading, no usable bookmark — and every
  page would have had to remember a `<svelte:head>` of its own. A screen that needs a different tab
  name (a record's own title, say) passes `documentTitle={false}` and writes its own.
-->
<svelte:head>{#if documentTitle}<title>{title} · Kern</title>{/if}</svelte:head>

<header class={cn('kph', compact && 'compact', className)}>
  {#if crumbs.length || search || actions}
    <div class="r1">
      {#if crumbs.length}<Breadcrumb items={crumbs} />{:else}<span class="sp"></span>{/if}
      {#if search}{@render search()}{/if}
      {#if actions}<div class="acts">{@render actions()}</div>{/if}
    </div>
  {/if}
  <div class="r2">
    <h1 class="t">{title}</h1>
    {#if subtitle}<span class="st">{subtitle}</span>{/if}
    {#if titleActions}<span class="ta">{@render titleActions()}</span>{/if}
  </div>
  {@render children?.()}
  {#if measure !== null && measure !== undefined}<div class="r3"><ProgressBar value={measure} variant="measure" /></div>{:else}<div class="r3 rule"></div>{/if}
</header>

<style>
  .kph { flex: none; padding: 20px 28px 0; background: var(--kern-surface); }
  .kph.compact { padding: 14px 24px 0; }
  .r1 { display: flex; align-items: center; gap: 16px; min-height: 32px; }
  .sp { flex: 1; }
  .acts { display: flex; align-items: center; gap: 8px; flex: none; }
  .r2 { display: flex; align-items: baseline; gap: 12px; margin-top: 10px; min-width: 0; }
  .kph.compact .r2 { margin-top: 6px; }
  .t { margin: 0; font-size: 25px; font-weight: 600; letter-spacing: -0.025em; line-height: 1.1; color: var(--kern-ink-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .kph.compact .t { font-size: 20px; }
  .st { font-family: var(--kern-font-mono); font-size: 12px; color: var(--kern-ink-300); letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .ta { margin-inline-start: auto; display: inline-flex; gap: 8px; align-self: center; }
  .r3 { margin-top: 16px; }
  .kph.compact .r3 { margin-top: 12px; }
  .r3.rule { height: 1px; background: var(--kern-border); }
  @media (max-width: 768px) { .kph { padding: 14px 16px 0; } .t { font-size: 21px; } }
</style>
