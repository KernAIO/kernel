<script lang="ts">
import Icon from '../icons/Icon.svelte'
import { cn } from '../utils.js'
export interface SegmentItem {
  value: string
  label?: string
  icon?: string
  title?: string
}
/** Office "Floor / Rooms" style: track #F0EDE4 r7 p2; active white r5 shadow. */
interface Props {
  items: SegmentItem[]
  value?: string
  size?: 'sm' | 'md'
  class?: string
  onValueChange?: (v: string) => void
  label?: string
}
let {
  items,
  value = $bindable(items[0]?.value ?? ''),
  size = 'md',
  class: className,
  onValueChange,
  label,
}: Props = $props()
function set(v: string) {
  value = v
  onValueChange?.(v)
}
function onKey(e: KeyboardEvent) {
  const i = items.findIndex((x) => x.value === value)
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault()
    const rtl = document.dir === 'rtl'
    const dir = (e.key === 'ArrowRight') !== rtl ? 1 : -1
    set(items[(i + dir + items.length) % items.length]!.value)
  }
}
</script>

<div class={cn('kseg', `s-${size}`, className)} role="radiogroup" tabindex={-1} aria-label={label} onkeydown={onKey}>
  {#each items as it (it.value)}
    <button type="button" role="radio" aria-checked={value === it.value} class="it" class:on={value === it.value} title={it.title ?? it.label} onclick={() => set(it.value)} tabindex={value === it.value ? 0 : -1}>
      {#if it.icon}<Icon name={it.icon} size={14} strokeWidth={1.7} />{/if}{#if it.label}<span>{it.label}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .kseg { display: inline-flex; padding: 2px; gap: 2px; background: var(--kern-surface-hover); border-radius: var(--kern-r-md2); }
  .it { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 12px; border-radius: var(--kern-r-sm); font-size: 13px; color: var(--kern-ink-450); white-space: nowrap; }
  .s-sm .it { height: 22px; padding: 0 9px; font-size: 12.5px; }
  .it.on { background: var(--kern-surface-raised); color: var(--kern-ink-900); font-weight: 500; box-shadow: var(--kern-shadow-segment); }
  .it:focus-visible { box-shadow: 0 0 0 3px var(--kern-ring); }
</style>
