/**
 * The arithmetic behind the report charts.
 *
 * Kept out of the components so it can be tested without a DOM: an axis that picks the wrong
 * maximum or a path that drops its last point is a bug you want caught by a test, not noticed by
 * somebody squinting at a line.
 */

export interface Series {
  /** what this line or bar group is called, for the legend and the accessible table */
  label: string
  values: number[]
  /** 1–5, matching the design system's `--chart-N` tokens */
  tone: 1 | 2 | 3 | 4 | 5
  /** drawn as a dashed line: an ideal, a target, something that is not measured */
  dashed?: boolean
}

export interface Scale {
  max: number
  /** the horizontal labels, one per index */
  ticks: number[]
}

/**
 * A maximum to draw against, rounded up to something a person would choose.
 *
 * Scaling exactly to the tallest value makes every chart look equally full, so a sprint that
 * finished two points and one that finished two hundred are indistinguishable.
 */
export function niceMax(values: number[]): number {
  const highest = Math.max(0, ...values.filter((v) => Number.isFinite(v)))
  if (highest <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(highest))
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = magnitude * step
    if (highest <= candidate) return candidate
  }
  return magnitude * 10
}

/** Evenly spaced gridline values, including 0 and the maximum. */
export function gridLines(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i)
}

/**
 * An SVG path for one series inside a box of `width` × `height`.
 *
 * A single point draws a short horizontal stroke rather than nothing: a cycle on its first day has
 * one measurement, and an empty chart reads as "no data" when the truth is "one day in".
 */
export function linePath(values: number[], max: number, width: number, height: number): string {
  const points = values.filter((v) => Number.isFinite(v))
  if (!points.length) return ''
  const y = (value: number) => height - (Math.max(0, value) / max) * height
  if (points.length === 1) return `M 0 ${y(points[0]!)} L ${width} ${y(points[0]!)}`
  const step = width / (points.length - 1)
  return points.map((value, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${y(value)}`).join(' ')
}

/** Where each bar in a group sits: `count` groups of `perGroup` bars across `width`. */
export function barLayout(
  count: number,
  perGroup: number,
  width: number,
): { groupWidth: number; barWidth: number; gap: number } {
  const groupWidth = count > 0 ? width / count : width
  // A quarter of each slot is breathing room, so groups read as groups.
  const gap = groupWidth * 0.25
  const barWidth = perGroup > 0 ? Math.max(2, (groupWidth - gap) / perGroup) : groupWidth
  return { groupWidth, barWidth, gap }
}

/**
 * Running totals for a stacked chart: each band's top is everything below it plus itself.
 *
 * Stacking is done here rather than in the component because getting it wrong is invisible — the
 * chart still draws, it just tells a different story, with bands that overlap or a total that does
 * not match the counts.
 */
export function stackSeries(series: number[][]): number[][] {
  const length = Math.max(0, ...series.map((s) => s.length))
  const running = new Array<number>(length).fill(0)
  return series.map((values) =>
    running.map((carried, i) => {
      const next = carried + Math.max(0, values[i] ?? 0)
      running[i] = next
      return next
    }),
  )
}

/**
 * A closed path for one band of a stacked area: along its own top, back along the band below it.
 *
 * `lower` is the band beneath — all zeroes for the first one. Drawing the return leg backwards is
 * what closes the shape; forwards would fold it over itself into a bow tie.
 */
export function areaPath(
  upper: number[],
  lower: number[],
  max: number,
  width: number,
  height: number,
): string {
  if (upper.length === 0) return ''
  const y = (value: number) => height - (Math.max(0, value) / max) * height
  const step = upper.length > 1 ? width / (upper.length - 1) : 0
  // One point has no width to sweep, so the band is drawn as a full-width slab instead of a
  // zero-area sliver nobody can see.
  const x = (i: number) => (upper.length > 1 ? i * step : i === 0 ? 0 : width)
  const top = upper.map((value, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(value)}`).join(' ')
  const bottom = [...lower]
    .map((value, i) => ({ value, i }))
    .reverse()
    .map(({ value, i }) => `L ${x(i)} ${y(value)}`)
    .join(' ')
  if (upper.length === 1)
    return `M 0 ${y(upper[0]!)} L ${width} ${y(upper[0]!)} L ${width} ${y(lower[0] ?? 0)} L 0 ${y(lower[0] ?? 0)} Z`
  return `${top} ${bottom} Z`
}
