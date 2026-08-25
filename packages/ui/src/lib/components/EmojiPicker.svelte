<script lang="ts">
import { t } from '../i18n.svelte.js'
import Icon from '../icons/Icon.svelte'
import { EMOJI_GROUPS, searchEmoji } from '../rich/emoji.js'

/**
 * Picking an emoji.
 *
 * Deliberately small: a few hundred of the emoji people actually use in a work conversation,
 * grouped and searchable, held in this repository rather than fetched. A picker that downloads a
 * megabyte of data the first time you want to say 👍 is not worth the completeness.
 *
 * Escape closes it, and clicking outside closes it, because a picker you cannot dismiss with the
 * keyboard is a trap.
 */

interface Props {
  onpick: (emoji: string) => void
  onclose: () => void
  /** anchor the panel to the end of its container instead of the start */
  align?: 'start' | 'end'
  /**
   * The button that opened this. A pointerdown on it must NOT count as "outside": closing here and
   * letting the trigger's own click reopen leaves a picker that its own button can never dismiss.
   */
  trigger?: HTMLElement | null
}
let { onpick, onclose, align = 'start', trigger = null }: Props = $props()

let query = $state('')
let panel = $state<HTMLElement | null>(null)
let searchEl = $state<HTMLInputElement | null>(null)

const results = $derived(query.trim() ? searchEmoji(query.trim()) : null)

$effect(() => {
  searchEl?.focus()
})

$effect(() => {
  const onPointerDown = (event: PointerEvent) => {
    const target = event.target as Node
    if (trigger?.contains(target)) return
    if (panel && !panel.contains(target)) onclose()
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onclose()
    }
  }
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('keydown', onKeyDown, true)
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('keydown', onKeyDown, true)
  }
})
</script>

<div
  bind:this={panel}
  class="picker"
  class:end={align === 'end'}
  role="dialog"
  aria-label={t('common.emoji')}
  data-testid="emoji-picker"
>
  <div class="search">
    <Icon name="search" size={14} strokeWidth={1.7} />
    <input
      bind:this={searchEl}
      bind:value={query}
      type="text"
      placeholder={t('common.emoji_search')}
      aria-label={t('common.emoji_search')}
      data-testid="emoji-search"
    />
  </div>

  <div class="scroll">
    {#if results}
      {#if results.length === 0}
        <p class="hint">{t('common.emoji_empty')}</p>
      {:else}
        <div class="grid">
          {#each results as e (e.emoji)}
            <button type="button" title={e.name} aria-label={e.name} onclick={() => onpick(e.emoji)}>
              {e.emoji}
            </button>
          {/each}
        </div>
      {/if}
    {:else}
      {#each EMOJI_GROUPS as group (group.id)}
        <h3>{group.label()}</h3>
        <div class="grid">
          {#each group.emoji as e (e.emoji)}
            <button type="button" title={e.name} aria-label={e.name} onclick={() => onpick(e.emoji)}>
              {e.emoji}
            </button>
          {/each}
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .picker {
    position: absolute;
    bottom: calc(100% + 6px);
    inset-inline-start: 0;
    z-index: 40;
    width: 296px;
    border: 1px solid var(--kern-border);
    border-radius: var(--kern-r-2xl);
    background: var(--kern-surface-raised);
    box-shadow: var(--kern-shadow-popover);
    overflow: hidden;
  }
  .picker.end {
    inset-inline-start: auto;
    inset-inline-end: 0;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--kern-border-hairline);
    color: var(--kern-ink-350);
  }
  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    font: inherit;
    font-size: 13px;
    color: var(--kern-ink-800);
    outline: none;
  }
  .search input:focus-visible {
    box-shadow: none;
  }
  .scroll {
    max-height: 244px;
    overflow-y: auto;
    padding: 6px;
  }
  h3 {
    margin: 6px 4px 4px;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--kern-ink-350);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 2px;
  }
  .grid button {
    display: grid;
    place-items: center;
    height: 30px;
    border: 0;
    border-radius: var(--kern-r-sm);
    background: none;
    font-size: 17px;
    line-height: 1;
    cursor: pointer;
  }
  .grid button:hover,
  .grid button:focus-visible {
    background: var(--kern-surface-hover);
    outline: none;
  }
  .hint {
    margin: 0;
    padding: 12px 8px;
    font-size: 12.5px;
    color: var(--kern-ink-350);
  }
</style>
