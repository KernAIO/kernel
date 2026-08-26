import { beforeEach, describe, expect, it } from 'vitest'
import { registerMessages, setMessageLocale, t } from './i18n.svelte.js'

/**
 * The message runtime every module's strings pass through, which until now had no test.
 *
 * Three behaviours matter and all three have shipped wrong somewhere: picking the right plural
 * form, formatting a number in the reader's digits, and failing visibly rather than silently when
 * a key is missing.
 */
beforeEach(() => {
  setMessageLocale('en')
  registerMessages('en', {
    'x.plain': 'Hello',
    'x.named': 'Hello {name}',
    'x.days': { one: '{count} day', other: '{count} days' },
    'x.range': { one: '{count} day, {range}', other: '{count} days, {range}' },
    'x.short': { other: '{count} things' },
  })
  registerMessages('ar', {
    'x.days': {
      zero: 'لا أيام',
      one: 'يوم',
      two: 'يومان',
      few: '{count} أيام',
      many: '{count} يومًا',
      other: '{count} يوم',
    },
  })
  registerMessages('fa', { 'x.days': { one: '{count} روز', other: '{count} روز' } })
})

describe('t', () => {
  it('returns the string, and interpolates named placeholders', () => {
    expect(t('x.plain')).toBe('Hello')
    expect(t('x.named', { name: 'Ada' })).toBe('Hello Ada')
  })

  /**
   * A missing key renders as the key, on purpose: `x.nothing` on a screen is visibly broken and
   * gets reported, where an empty string is a blank space nobody notices.
   */
  it('falls back to the key rather than to nothing', () => {
    expect(t('x.nothing')).toBe('x.nothing')
    expect(t('x.named')).toBe('Hello {name}')
  })

  it('falls back to English for a locale that has not translated the key', () => {
    setMessageLocale('fa')
    expect(t('x.plain')).toBe('Hello')
  })

  describe('plural selection', () => {
    it('picks one for 1 and other for everything else in English', () => {
      expect(t('x.days', { count: 1 })).toBe('1 day')
      expect(t('x.days', { count: 0 })).toBe('0 days')
      expect(t('x.days', { count: 2 })).toBe('2 days')
    })

    it('follows the locale, not English — Arabic inflects six ways', () => {
      setMessageLocale('ar')
      expect(t('x.days', { count: 0 })).toBe('لا أيام')
      expect(t('x.days', { count: 1 })).toBe('يوم')
      expect(t('x.days', { count: 2 })).toBe('يومان')
      // 3–10 take the plural of paucity; 11–99 the accusative singular.
      expect(t('x.days', { count: 5 })).toContain('أيام')
      expect(t('x.days', { count: 11 })).toContain('يومًا')
    })

    it('accepts `n` as well as `count`, since both names are in the catalogues', () => {
      expect(t('x.days', { n: 1, count: 1 })).toBe('1 day')
    })

    /** A form the locale needs but the catalogue lacks renders `other` rather than the key. */
    it('falls back to other for a category the catalogue does not define', () => {
      expect(t('x.short', { count: 1 })).toBe('1 things')
    })

    it('falls back to other when no count was passed at all', () => {
      expect(t('x.days')).toBe('{count} days')
    })

    it('keeps the other placeholders in whichever form is chosen', () => {
      expect(t('x.range', { count: 1, range: 'Mon–Fri' })).toBe('1 day, Mon–Fri')
      expect(t('x.range', { count: 4, range: 'Mon–Fri' })).toBe('4 days, Mon–Fri')
    })
  })

  describe('numbers', () => {
    /**
     * A raw number left in the string is the one untranslated thing on a Persian screen, and it is
     * the mistake nobody notices in English — so `t()` formats every numeric parameter itself.
     */
    it('formats a numeric parameter in the reader’s own digits', () => {
      setMessageLocale('fa')
      expect(t('x.days', { count: 5 })).toContain('۵')
      setMessageLocale('en')
      expect(t('x.days', { count: 5 })).toContain('5')
    })

    it('groups a large number the way the locale does', () => {
      registerMessages('en', { 'x.big': '{count} things' })
      expect(t('x.big', { count: 12345 })).toBe('12,345 things')
    })

    it('leaves a string parameter exactly as given', () => {
      setMessageLocale('fa')
      expect(t('x.named', { name: '5' })).toBe('Hello 5')
    })
  })
})
