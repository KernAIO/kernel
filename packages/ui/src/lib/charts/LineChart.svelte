<script lang="ts">
import { t } from '../i18n.svelte.js'
import { gridLines, linePath, niceMax, type Series } from './chart.js'

/**
 * A time series, drawn in SVG against the design system's chart tokens.
 *
 * There is no chart library here on purpose: every one of them brings its own type scale, colours
 * and tooltips, and would then have to be argued out of them one property at a time.
 *
 * The numbers are also given as a table for anyone the picture does not reach — a screen reader,
 * or somebody who needs the value rather than the shape. It is visually hidden, not absent.
 */
interface Props {
  series: Series[]
  labels: string[]
  title: string
  /** how to render a value in the table and the axis */
  format?: (value: number) => string
  height?: number
}
let { series, labels, title, format = (v) => String(Math.round(v)), height = 160 }: Props = $props()

const WIDTH = 640
const max = $derived(niceMax(series.flatMap((s) => s.values)))
const lines = $derived(gridLines(max))
const hasData = $derived(series.some((s) => s.values.some((v) => Number.isFinite(v))))
/** Only a few labels fit; the rest would overlap into an unreadable smear. */
const labelEvery = $derived(Math.max(1, Math.ceil(labels.length / 7)))
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
      {#each series as s (s.label)}
        <path
          d={linePath(s.values, max, WIDTH, height)}
          class="line"
          class:dashed={s.dashed}
          style:stroke="var(--chart-{s.tone})"
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
            {#each series as s (s.label)}<td>{format(s.values[i] ?? 0)}</td>{/each}
          </tr>
        {/each}
      </tbody>
    </table>

    <figcaption class="legend">
      {#each series as s (s.label)}
        <span class="key">
          <span class="swatch" class:dashed={s.dashed} style:background="var(--chart-{s.tone})"></span>
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
  overflow: visible;
}
.grid {
  stroke: var(--kern-border-hairline);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.line {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}
.line.dashed {
  stroke-dasharray: 4 4;
  opacity: 0.7;
}
.axis {
  /*
   * Left to right whatever the page direction is. The SVG is drawn left to right and does not
   * flip, so a mirrored axis would put the earliest date under the latest point — the labels and
   * the line would disagree. A time axis reads the same way in every locale.
   */
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
  height: 3px;
  border-radius: 2px;
}
.swatch.dashed {
  opacity: 0.6;
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
