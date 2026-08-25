<script lang="ts">
import { t } from '../i18n.svelte.js'
import type { MentionCandidate } from '../rich/mentions.js'
import Avatar from './Avatar.svelte'

/**
 * The people list that opens when somebody types `@`.
 *
 * It sits above the composer, keyboard first: the composer keeps focus and forwards the arrow keys,
 * so you never have to reach for the mouse in the middle of a sentence. Nothing here is clickable
 * that is not also reachable by keyboard.
 */

interface Props {
  candidates: MentionCandidate[]
  /** index of the highlighted row, owned by the composer because it owns the keyboard */
  active: number
  /** true while the whole workspace is still being loaded */
  loading?: boolean
  onpick: (person: MentionCandidate) => void
  onhover: (index: number) => void
}
let { candidates, active, loading = false, onpick, onhover }: Props = $props()
</script>

<div
  id="chat-mention-menu"
  class="menu"
  role="listbox"
  aria-label={t('common.mention')}
  data-testid="mention-menu"
>
  {#if loading}
    <p class="hint">{t('common.mention_loading')}</p>
  {:else if candidates.length === 0}
    <p class="hint">{t('common.mention_empty')}</p>
  {:else}
    {#each candidates as person, i (person.id)}
      <button
        id={`chat-mention-${i}`}
        type="button"
        role="option"
        aria-selected={i === active}
        class="row"
        class:active={i === active}
        data-testid="mention-option"
        onmousedown={(e) => {
          // mousedown, not click: the composer must not lose focus before the insert happens
          e.preventDefault()
          onpick(person)
        }}
        onmouseenter={() => onhover(i)}
      >
        <Avatar name={person.name} id={person.id} src={person.avatarUrl} size={22} />
        <span class="name">{person.name}</span>
        {#if person.username}<span class="username">@{person.username}</span>{/if}
      </button>
    {/each}
  {/if}
</div>

<style>
  .menu {
    position: absolute;
    bottom: calc(100% + 6px);
    inset-inline-start: 0;
    z-index: 30;
    width: min(320px, 100%);
    max-height: 260px;
    overflow-y: auto;
    padding: 4px;
    border: 1px solid var(--kern-border);
    border-radius: var(--kern-r-2xl);
    background: var(--kern-surface-raised);
    box-shadow: var(--kern-shadow-popover);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    border: 0;
    border-radius: var(--kern-r-md);
    background: none;
    text-align: start;
    cursor: pointer;
  }
  .row.active {
    background: var(--kern-surface-hover);
  }
  .name {
    font-size: 13.5px;
    color: var(--kern-ink-900);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .username {
    font-size: 12.5px;
    color: var(--kern-ink-350);
    white-space: nowrap;
  }
  .hint {
    margin: 0;
    padding: 10px 10px;
    font-size: 12.5px;
    color: var(--kern-ink-350);
  }
</style>
