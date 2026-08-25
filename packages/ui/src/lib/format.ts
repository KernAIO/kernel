import { messageLocale } from './i18n.svelte.js'

/**
 * Locale-aware formatting for anything a module renders.
 *
 * In the framework rather than the app because a module's screens are full of dates and counts, and
 * every one of them has to agree with the shell about the current language. The locale comes from
 * the same place module strings do (`i18n.svelte.ts`), which the shell keeps in step with its own
 * Paraglide locale.
 *
 * `localPlace()` stays in the app: it translates an IANA zone to a city name from generated CLDR
 * data that ships with the app's catalogues, and nothing in a module needs it.
 */

/** Locale-aware relative time ("11m", "3h", "2d") for dense rows. */
export function relativeTime(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat(messageLocale(), { numeric: 'auto', style: 'narrow' })
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 864e5],
    ['month', 30 * 864e5],
    ['week', 7 * 864e5],
    ['day', 864e5],
    ['hour', 3600e3],
    ['minute', 60e3],
  ]
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit)
  }
  return rtf.format(Math.round(diff / 1000), 'second')
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Intl.DateTimeFormat(messageLocale(), opts).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return formatDate(iso, { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * A date range as one string.
 *
 * `formatRange`, never two dates and a dash: a hand-built range reads backwards under `dir="rtl"`
 * — the earlier date lands to the right of the later one — and this collapses the parts the two
 * dates share for free.
 */
export function formatDateRange(
  fromIso: string,
  toIso: string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  return new Intl.DateTimeFormat(messageLocale(), opts).formatRange(new Date(fromIso), new Date(toIso))
}

/** Today's date as shown under the home greeting. */
export function today(): string {
  return new Intl.DateTimeFormat(messageLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
}

/** The wall clock, in the interface language. */
export function localTime(at: Date = new Date()): string {
  return new Intl.DateTimeFormat(messageLocale(), { hour: '2-digit', minute: '2-digit' }).format(at)
}

/**
 * A count as a badge shows it.
 *
 * Numbers go through `Intl` for the same reason dates do: a Persian interface writes them in Persian
 * digits, and a badge reading "2" beside "۱۱ دقیقه پیش" is the one number on the screen that did not
 * get translated. The cap is here rather than in the badge component so every caller agrees on it —
 * a nav row is not wide enough to argue with a four-digit unread count.
 */
export function formatCount(n: number, max = 99): string {
  const nf = new Intl.NumberFormat(messageLocale())
  return n > max ? `${nf.format(max)}+` : nf.format(n)
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/**
 * A byte count as a short human string.
 *
 * 1024, not 1000, and `KB` rather than `Intl`'s `kB`: this number sits beside the one the operating
 * system's file browser shows, and a size that disagrees with Finder reads as a bug. `Intl`'s `unit`
 * style is SI — it would render 1024 bytes as "1 kB" — so the unit is spelled out here on purpose.
 *
 * `locale` is a parameter only so a test can pin it; everything real uses the interface language.
 */
export function formatBytes(bytes: number, locale = messageLocale()): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1)
  const value = bytes / 1024 ** exponent
  // Whole numbers for bytes, one decimal above that: "1.4 MB" reads better than "1.44 MB".
  const digits = exponent === 0 ? 0 : value >= 10 ? 0 : 1
  return `${value.toLocaleString(locale, { maximumFractionDigits: digits })} ${BYTE_UNITS[exponent]}`
}
