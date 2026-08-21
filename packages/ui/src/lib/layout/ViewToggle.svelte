<script lang="ts">
import Icon from '../icons/Icon.svelte'

/** View-mode icon buttons (List / Board …): 30×30 r8, active ink (DESIGN.md §2.5). */
interface Props {
  items: { value: string; icon: string; label: string }[]
  value?: string
  onValueChange?: (v: string) => void
}
let { items, value = $bindable(items[0]?.value ?? ''), onValueChange }: Props = $props()
</script>

<div class="kvt" role="radiogroup" aria-label="View">
  {#each items as it (it.value)}
    <button type="button" role="radio" aria-checked={value === it.value} aria-label={it.label} title={it.label} class="b" class:on={value === it.value} onclick={() => { value = it.value; onValueChange?.(it.value) }}>
      <Icon name={it.icon} size={16} strokeWidth={1.6} />
    </button>
  {/each}
</div>

<style>
  .kvt { display: inline-flex; gap: 2px; }
  .b { width: 30px; height: 30px; border-radius: var(--kern-r-lg); display: grid; place-items: center; color: var(--kern-ink-350); }
  .b:hover { background: var(--kern-surface-hover); }
  .b.on, .b.on:hover { background: var(--kern-ink-900); color: var(--kern-ink-inverse); }
</style>
