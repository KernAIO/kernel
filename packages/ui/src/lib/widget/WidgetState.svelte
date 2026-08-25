<script lang="ts">
import type { Snippet } from 'svelte'
import Button from '../components/Button.svelte'
import EmptyState from '../components/EmptyState.svelte'
import Skeleton from '../components/Skeleton.svelte'
import { t } from '../i18n.svelte.js'

/**
 * Loading, failed and empty for one widget body, so every card on the dashboard reports the same
 * three states the same way.
 *
 * In the framework because a module's widgets render it, and its words come from the common
 * bundle — a module should not have to translate "Retry" to show a widget that failed.
 */

/**
 * The four states, in a card three hundred pixels wide.
 *
 * Every widget needs them and none of them are interesting, so they live here once: a skeleton
 * shaped like a list rather than a spinner, an empty state that says what would fill it, and an
 * error that offers a retry instead of a blank card.
 */
interface Props {
  pending: boolean
  error: unknown
  empty: boolean
  emptyTitle: string
  emptyIcon?: string
  rows?: number
  onRetry?: () => void
  children: Snippet
}
let { pending, error, empty, emptyTitle, emptyIcon, rows = 4, onRetry, children }: Props = $props()
</script>

{#if pending}
  <div class="skeleton">
    {#each Array(rows) as _, i (i)}
      <Skeleton height="14px" />
    {/each}
  </div>
{:else if error}
  <div class="failed">
    <p>{error instanceof Error ? error.message : t('common.error')}</p>
    {#if onRetry}
      <Button size="sm" variant="ghost" onclick={onRetry}>{t('common.retry')}</Button>
    {/if}
  </div>
{:else if empty}
  <div class="empty">
    <EmptyState icon={emptyIcon} title={emptyTitle} compact bare />
  </div>
{:else}
  {@render children()}
{/if}

<style>
  .skeleton {
    display: grid;
    gap: 12px;
    padding: 14px;
  }
  .empty {
    display: grid;
    place-items: center;
    min-height: 100%;
    padding: 14px;
  }
  .failed {
    display: grid;
    justify-items: start;
    gap: 6px;
    padding: 14px;
    font-size: 12.5px;
    color: var(--kern-ink-600);
  }
</style>
