<script lang="ts">
import { cn } from '../utils.js'
import Avatar from './Avatar.svelte'

interface Person {
  id?: string | null
  name?: string | null
  avatarUrl?: string | null
}
interface Props {
  people: Person[]
  size?: number
  max?: number
  class?: string
}
let { people, size = 24, max = 4, class: className }: Props = $props()
const shown = $derived(people.slice(0, max))
const extra = $derived(Math.max(0, people.length - max))
</script>

<div class={cn('kavs', className)} style:--ov="-6px">
  {#each shown as p, i (p.id ?? i)}
    <span class="it" style:z-index={shown.length - i}><Avatar id={p.id} name={p.name} src={p.avatarUrl} {size} ring /></span>
  {/each}
  {#if extra > 0}
    <span class="it more" style="--s:{size}px;--fs:{Math.max(9, Math.round(size * 0.36))}px">+{extra}</span>
  {/if}
</div>

<style>
  .kavs { display: inline-flex; align-items: center; }
  .it { display: inline-flex; }
  .it + .it { margin-inline-start: var(--ov); }
  .more { width: var(--s); height: var(--s); border-radius: 999px; background: var(--kern-surface-chip); color: var(--kern-ink-450); font-size: var(--fs); font-weight: 600; display: inline-grid; place-items: center; box-shadow: var(--kern-shadow-avatar-ring); }
</style>
