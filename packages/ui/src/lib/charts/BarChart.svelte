<script lang="ts">
import { t } from '../i18n.svelte.js'
import { barLayout, gridLines, niceMax, type Series } from './chart.js'

/**
 * Grouped bars — one group per period, one bar per series.
 *
 * Same rules as the line chart: the design system's colours, no library, and the numbers given as a
 * table for anyone the picture does not reach.
 */
interface Props {
  series: Series[]
  labels: string[]
  title: string
  format?: (value: number) => string
  height?: number
}
let { series, labels, title, format = (v) => String(Math.round(v)), height = 160 }: Props = $props()

const WIDTH = 640
const max = $derived(niceMax(series.flatMap((s) => s.values)))
const lines = $derived(gridLines(max))
const layout = $derived(barLayout(labels.length, series.length, WIDTH))
const hasData = $derived(series.some((s) => s.values.some((v) => v > 0)))
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
      {#each labels as label, group (label + group)}
        {#each series as s, i (s.label)}
          {@const value = Math.max(0, s.values[group] ?? 0)}
          {@const barHeight = (value / max) * height}
          <rect
            x={group * layout.groupWidth + layout.gap / 2 + i * layout.barWidth}
            y={height - barHeight}
            width={Math.max(1, layout.barWidth - 1)}
            height={barHeight}
            style:fill="var(--chart-{s.tone})"
          />
        {/each}
      {/each}
    </svg>

    <div class="axis" aria-hidden="true">
      {#each labels as label, i (label + i)}<span>{label}</span>{/each}
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
            {#each series as s (s.label)}<td>{format(s.values[i] ?? 0)}</td>{/each}
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
      <span class="scale">{t('common.chart_max', { value: format(max) })}</span>
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
}
.grid {
  stroke: var(--kern-border-hairline);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.axis {
  /*
   * Left to right whatever the page direction is. The SVG is drawn left to right and does not
   * flip, so a mirrored axis would put the earliest date under the latest point — the labels and
   * the line would disagree. A time axis reads the same way in every locale.
   */
  direction: ltr;
  display: flex;
  justify-content: space-around;
  margin-top: 4px;
  font-size: 11px;
  color: var(--kern-ink-400);
}
.legend {
  display: flex;
  align-items: center;
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
