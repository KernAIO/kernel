<script lang="ts">
import type { Snippet } from 'svelte'
import { cn } from '../utils.js'

/**
 * Dense table primitives. Usage:
 *  <Table columns="minmax(0,1.4fr) minmax(0,1fr) 92px"> <TableHeader>…</TableHeader> <TableRow>…</TableRow> </Table>
 * Each header/row is a CSS grid using the provided columns template (no <table> so rows can be links).
 */
interface Props {
  columns: string
  class?: string
  children: Snippet
  dense?: boolean
  role?: string
  /** accessible name — a `role="table"` with none is announced as just "table" */
  ariaLabel?: string
}
let { columns, class: className, children, dense = false, role = 'table', ariaLabel }: Props = $props()
</script>

<div class={cn('ktbl', dense && 'dense', className)} style:--cols={columns} {role} aria-label={ariaLabel}>{@render children()}</div>

<style>
  .ktbl { display: flex; flex-direction: column; min-width: 0; width: 100%; }
  .ktbl :global(.ktr), .ktbl :global(.kth) { display: grid; grid-template-columns: var(--cols); gap: 12px; align-items: center; padding: 0 12px; border-bottom: 1px solid var(--kern-border-hairline); min-width: 0; }
  .ktbl :global(.kth) { height: 34px; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--kern-ink-280); }
  .ktbl :global(.ktr) { min-height: 48px; font-size: 13px; color: var(--kern-ink-600); text-decoration: none; cursor: default; }
  .ktbl.dense :global(.ktr) { min-height: 40px; }
  .ktbl :global(.ktr.clickable) { cursor: pointer; }
  .ktbl :global(.ktr:hover) { background: var(--kern-surface-raised); }
  .ktbl :global(.ktd) { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; align-items: center; gap: 8px; }
  .ktbl :global(.ktd.end) { justify-content: flex-end; }
</style>
