<script lang="ts">
/** 36×36 ink square with "K" + accent tick (DESIGN.md §2.2). */
interface Props {
  href?: string
  label?: string
  letter?: string
  size?: number
  onclick?: (e: MouseEvent) => void
}
let { href = '/', label = 'Home', letter = 'K', size = 36, onclick }: Props = $props()
</script>

<a {href} class="klogo" aria-label={label} {onclick} style:--s="{size}px" style:--fs="{Math.round(size * 0.44)}px">
  <span class="k">{letter}</span><span class="tick"></span>
</a>

<style>
  .klogo { width: var(--s); height: var(--s); border-radius: var(--kern-r-2xl); background: var(--kern-ink-900); display: inline-flex; align-items: center; justify-content: center; gap: 3px; color: var(--kern-ink-inverse); text-decoration: none; flex: none; }
  .k { font-size: var(--fs); font-weight: 600; letter-spacing: -0.03em; line-height: 1; }
  .tick { width: 2px; height: 14px; border-radius: 1px; background: var(--kern-accent); }
</style>
