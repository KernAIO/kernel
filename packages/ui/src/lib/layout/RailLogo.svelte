<script lang="ts">
/**
 * The Kern mark in the rail (DESIGN.md §2.2): the K and the accent tick.
 *
 * The K is a path rather than a styled `<span>`. A CSS-drawn mark is a fourth copy of the
 * geometry to keep in sync with the favicon, the app icons and the site, and it drifts —
 * this one centred the letter and the tick as two independent boxes, so the pair sat left
 * of the square's centre at every size. Geometry: kern `docs/brand.md`.
 */
interface Props {
  href?: string
  label?: string
  size?: number
  onclick?: (e: MouseEvent) => void
}
let { href = '/', label = 'Home', size = 36, onclick }: Props = $props()
</script>

<a {href} class="klogo" aria-label={label} {onclick} style:--s="{size}px">
  <svg viewBox="0 0 144 144" aria-hidden="true">
    <path
      d="M38.81 99.36V44.64H48.69V99.36ZM45.98 70.94 71.87 44.64H85.17L58.16 70.94ZM73.09 99.36 45.83 70.94H58.16L86.69 99.36Z"
      fill="var(--kern-ink-inverse)"
    />
    <rect x="96.19" y="44" width="9" height="56" rx="4.5" fill="var(--kern-accent)" />
  </svg>
</a>

<style>
  .klogo { width: var(--s); height: var(--s); border-radius: var(--kern-r-2xl); background: var(--kern-ink-900); display: inline-flex; align-items: center; justify-content: center; text-decoration: none; flex: none; }
  .klogo svg { width: 100%; height: 100%; display: block; }
</style>
