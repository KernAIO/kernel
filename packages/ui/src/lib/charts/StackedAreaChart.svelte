<script lang="ts">
import { t } from '../i18n.svelte.js'
import { areaPath, gridLines, niceMax, type Series, stackSeries } from './chart.js'

/**
 * Bands stacked on each other over time — a cumulative flow diagram.
 *
 * The point of a CFD is the width of each band, not its height: a widening "In progress" band is
 * work piling up faster than it is finished, which is the thing a team wants to see and the reason
 * a set of separate lines will not do.
 *
 * Same trade as the other charts: no chart library, and the numbers repeated as a table for anyone
 * the picture does not reach.
 */
interface Props {
  series: Series[]
  labels: string[]
  title: string
  height?: number
}
let { series, labels, title, height = 180 }: Props = $props()

const WIDTH = 640
const stacked = $derived(stackSeries(series.map((s) => s.values)))
/** The top band is the total, so the scale comes from it rather than from the tallest band. */
const max = $derived(niceMax(stacked.at(-1) ?? []))
const lines = $derived(gridLines(max))
const hasData = $derived(series.some((s) => s.values.some((v) => v > 0)))
const labelEvery = $derived(Math.max(1, Math.ceil(labels.length / 7)))
/** What sits under each band: the one below it, or the floor for the first. */
const floors = $derived(stacked.map((_, i) => (i === 0 ? stacked[0]!.map(() => 0) : stacked[i - 1]!)))
</script>

{#if !hasData}
  <p class="empty">{t('common.no_data')}</p>
{:else}
  <figure class="chart">
    <svg viewBox="0 0 {WIDTH} {height}" role="img" aria-label={title} preserveAspectRatio="none">
      {#each lines as value (value)}
        {@const y = height - (value / max) * height}
        <line x1="0" x2={WIDTH} y1={y} y2={y} class="grid" />
      {/each}
      <!-- Bottom band first. Each path is closed between its own floor and its own top, so the
           order only decides which edge sits on top where they meet. -->
      {#each series as s, i (s.label)}
        <path
          d={areaPath(stacked[i] ?? [], floors[i] ?? [], max, WIDTH, height)}
          class="band"
          style:fill="var(--chart-{s.tone})"
        />
      {/each}
    </svg>

    <div class="axis" aria-hidden="true">
      {#each labels as label, i (label + i)}
        <span class:hidden={i % labelEvery !== 0}>{label}</span>
      {/each}
    </div>

    <table class="sr-only">
      <caption>{title}</caption>
      <thead>
        <tr>
          <th scope="col">{t('common.chart_when')}</th>
          {#each series as s (s.label)}<th scope="col">{s.label}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each labels as label, i (label + i)}
          <tr>
            <th scope="row">{label}</th>
            {#each series as s (s.label)}<td>{s.values[i] ?? 0}</td>{/each}
          </tr>
        {/each}
      </tbody>
    </table>

    <figcaption class="legend">
      {#each series as s (s.label)}
        <span class="key">
          <span class="swatch" style:background="var(--chart-{s.tone})"></span>
          {s.label}
        </span>
      {/each}
      <span class="scale">{t('common.chart_max', { value: String(max) })}</span>
    </figcaption>
  </figure>
{/if}

<style>
.chart {
  margin: 8px 0 0;
}
svg {
  width: 100%;
  height: auto;
  overflow: visible;
}
.grid {
  stroke: var(--kern-border-hairline);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.band {
  stroke: none;
  opacity: 0.85;
}
.axis {
  /* Left to right whatever the page direction is; see LineChart for why. */
  direction: ltr;
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 11px;
  color: var(--kern-ink-400);
}
.axis .hidden {
  visibility: hidden;
}
.legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--kern-ink-550);
}
.key {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}
.scale {
  margin-inline-start: auto;
  color: var(--kern-ink-400);
}
.empty {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--kern-ink-350);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
</style>
