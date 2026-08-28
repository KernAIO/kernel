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
import { commonMessages } from './common-messages.js'

export type { Message }

/**
 * Merged messages per locale: `{ en: { 'chat.nav': 'Chat' } }`.
 *
 * `$state`, and that is load-bearing rather than tidiness. A module registers its bundle when the
 * shell registers the module, and the framework's own `common` bundle registers as a side effect of
 * importing `common-messages.js` — both of which can land *after* a lazily-loaded screen has already
 * drawn. While this was a plain object those screens kept their raw keys for ever, because nothing
 * re-rendered: tracker's settings pages showed a button labelled `common.add`, which is also why
 * `getByRole('button', { name: 'Add' })` matched nothing and thirteen end-to-end tests waited out
 * their timeout.
 *
 * The comment below has always claimed this was reactive. It described `current` on the next line.
 */
const bundles = $state<Record<string, Record<string, Message>>>({})

/*
 * The framework's own words — Add, Cancel, Delete, Save — are seeded here rather than registering
 * themselves from `common-messages.ts`. See the note at the foot of that file: a registration that
 * happens as an import side effect is one a bundler may drop, and it did.
 */
for (const [locale, messages] of Object.entries(commonMessages))
  bundles[locale] = { ...bundles[locale], ...messages }

/**
 * The locale `t()` resolves against. Reactive for the same reason `bundles` is: every module string
 * on screen is a `t()` call that reads both, so changing either re-renders all of them — which is
 * what makes the language switcher work without a reload.
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
    const value = params[name] ?? countAlias(name, params)
    // A placeholder nobody supplied stays visible. Rendering it as empty, or as zero, turns a bug
    // at the call site into a sentence that reads as though it meant something.
    if (value === undefined) return `{${name}}`
    return typeof value === 'number' ? new Intl.NumberFormat(current).format(value) : String(value)
  })
}

/**
 * `{n}` and `{count}` are the same placeholder, because `count` and `n` are the same argument.
 *
 * `selectPlural` has always accepted either name, and every shipped catalogue writes `{n}` while
 * most call sites pass `count`. Interpolation matched on the exact name, so those messages chose
 * the right plural form and then printed the placeholder — "{n} other person here", on the byline
 * of a document two people were editing. It survived because every test used a `{count}` catalogue
 * with a `count` argument, which is the one pairing of the four that cannot fail.
 */
function countAlias(name: string, params: Record<string, string | number>): string | number | undefined {
  if (name === 'n') return params.count
  if (name === 'count') return params.n
  return undefined
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
 *
 * **An already-namespaced key is passed through untouched.** `t('common.save')` has to reach the
 * shared bundle, and blindly prefixing turned it into `tracker.common.save` — which nothing defines,
 * so `t()` fell back to returning the key and 164 call sites across six modules rendered
 * `tracker.common.widget_issues_title` on screen. A key with a dot in it already says which
 * namespace it belongs to; only a bare one is this module's.
 */
export function scopedT(moduleId: string) {
  return (key: string, params?: Record<string, string | number>) =>
    t(key.includes('.') ? key : `${moduleId}.${key}`, params)
}
