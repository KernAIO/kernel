/**
 * Message runtime for module UI.
 *
 * The app's own strings go through Paraglide, which compiles `messages/*.json` into functions and
 * cannot see a module that ships separately. So a module carries its own bundles, declares them as
 * `messages` on its client module, and the shell merges them here.
 *
 * One runtime, not one per module. A module that brings its own `t()` also brings its own locale
 * variable for the shell to remember to update — chat's first draft did exactly that, and its
 * locale was a plain `let`, so switching language left every chat string in the previous one.
 *
 * Keys are namespaced by the module that owns them (`chat.nav`, `hr.leave_balance`) and merged into
 * one map per locale. That is what makes a single `t()` safe: two modules cannot collide unless
 * they claim each other's prefix.
 */

import type { Message } from '@kernhq/kernel/client'

export type { Message }

/** Merged messages per locale: `{ en: { 'chat.nav': 'Chat' } }`. */
const bundles: Record<string, Record<string, Message>> = {}

/**
 * Reactive on purpose. Every module string on screen is a `t()` call, and `t()` reads this — so
 * changing it re-renders all of them, which is the whole reason the language switcher works
 * without a reload.
 */
let current = $state('en')

/** The locale `t()` resolves against. The shell sets it; nothing else should. */
export function setMessageLocale(locale: string) {
  current = locale
}

export function messageLocale(): string {
  return current
}

/**
 * Merge one module's bundle for one locale. Called by the shell as it registers a module, and
 * again when a locale is loaded lazily — later calls win for the keys they name, so a module can
 * ship English eagerly and the rest on demand.
 */
export function registerMessages(locale: string, messages: Record<string, Message>) {
  bundles[locale] = { ...bundles[locale], ...messages }
}

/**
 * Translate a namespaced key, interpolating `{name}` placeholders.
 *
 * Numbers go through `Intl.NumberFormat` for the current locale, so a count on a Persian screen
 * reads ۱۲ rather than 12 — interpolating a raw number leaves the one untranslated thing on the
 * page, and it is the mistake nobody notices in English.
 *
 * Falls back to English, then to the key itself. Returning the key is deliberate: a missing string
 * that renders as `chat.nav` is visibly broken, where returning an empty string is a blank space
 * nobody reports.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const found = bundles[current]?.[key] ?? bundles.en?.[key]
  if (found === undefined) return key
  const raw = typeof found === 'string' ? found : selectPlural(found, params)
  if (raw === undefined) return key
  if (!params) return raw
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name]
    if (value === undefined) return `{${name}}`
    return typeof value === 'number' ? new Intl.NumberFormat(current).format(value) : String(value)
  })
}

/**
 * Pick the form for the count, falling back to `other` — the one category every locale has.
 *
 * The count is whichever of `count` or `n` the caller passed; those are the two names the
 * catalogues use. A counted message called without one is a bug at the call site, and falling back
 * to `other` renders something sensible rather than the key.
 */
function selectPlural(
  forms: Partial<Record<Intl.LDMLPluralRule, string>>,
  params?: Record<string, string | number>,
): string | undefined {
  const count = params?.count ?? params?.n
  if (typeof count !== 'number') return forms.other
  return forms[new Intl.PluralRules(current).select(count)] ?? forms.other
}

/**
 * A `t()` bound to one module's prefix, so its components write `t('nav')` rather than repeating
 * their own id in every call.
 */
export function scopedT(moduleId: string) {
  return (key: string, params?: Record<string, string | number>) => t(`${moduleId}.${key}`, params)
}
