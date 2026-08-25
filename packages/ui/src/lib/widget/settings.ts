import type { WidgetSettingField, WidgetSettings } from '../module.js'

/**
 * Per-instance widget settings: what a stored value means once the widget that wrote it has moved
 * on, and how a setting reaches a query key.
 *
 * No `$msg` — this is unit-tested, and a module that imports the message catalogue cannot be.
 */

export function defaultsOf(fields: WidgetSettingField[] | undefined): WidgetSettings {
  const out: WidgetSettings = {}
  for (const f of fields ?? []) out[f.key] = f.default
  return out
}

/**
 * The settings a widget actually receives.
 *
 * Declared defaults first, saved values over the top, and **anything the widget no longer declares
 * is dropped** — a stored key whose field was removed is not a setting any more, it is a fossil, and
 * passing it on means a widget branching on something nobody can see or change.
 */
export function resolveSettings(
  fields: WidgetSettingField[] | undefined,
  saved: WidgetSettings | undefined,
): WidgetSettings {
  const defaults = defaultsOf(fields)
  if (!saved) return defaults
  const out: WidgetSettings = { ...defaults }
  for (const f of fields ?? []) {
    const value = saved[f.key]
    if (value === undefined) continue
    if (f.kind === 'number' && typeof value === 'number') {
      out[f.key] = Math.min(f.max, Math.max(f.min, value))
    } else if (f.kind === 'toggle' && typeof value === 'boolean') {
      out[f.key] = value
    } else if (f.kind === 'text' && typeof value === 'string') {
      out[f.key] = f.maxLength ? value.slice(0, f.maxLength) : value
    } else if (f.kind === 'select' && (typeof value === 'string' || value === null)) {
      // Options can be loaded asynchronously, so a value cannot be validated against them here —
      // only its shape. A widget that receives a stale option shows its empty state, which is the
      // honest outcome when the project a card pointed at has been deleted.
      out[f.key] = value
    }
  }
  return out
}

/**
 * A stable string for a widget instance's settings, for the query key.
 *
 * This is the difference between a working settings dialog and one that appears broken. A query key
 * that does not change when the settings change means TanStack serves the cached result, so
 * switching a card from one project to another does nothing — and only ever on a warm cache, which
 * is exactly the bug `includeArchived` produced on the tracker settings pages.
 */
export function settingsScope(settings: WidgetSettings | undefined): string {
  if (!settings) return ''
  return Object.keys(settings)
    .sort()
    .map((k) => `${k}=${String(settings[k])}`)
    .join('&')
}
