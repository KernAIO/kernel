import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CALLOUT_TONES, calloutTone, DEFAULT_CALLOUT_TONE } from './callout.js'

/**
 * The other half of the callout contract.
 *
 * `CALLOUT_TONES` is closed so that every tone maps to a colour pair, and the extension narrows an
 * unknown tone to `info` on the strength of that promise. Nothing enforced it, and the lists drifted:
 * five tones, four rules, and a `note` callout rendered with no tint on either side of the wire —
 * not a fallback, because `note` is a *valid* tone and never reaches the narrowing.
 */

const prose = readFileSync(new URL('../../styles/prose.css', import.meta.url), 'utf8')

/** Every `[data-callout="…"]` rule in prose.css, with the declarations it carries. */
const dressed = new Map(
  [...prose.matchAll(/\.kern-callout\[data-callout="([a-z]+)"\]\s*\{([^}]*)\}/g)].map(
    ([, tone, body]) => [tone, body] as const,
  ),
)

describe('callout tones', () => {
  it('dresses exactly the tones the extension can produce', () => {
    expect([...dressed.keys()].sort()).toEqual([...CALLOUT_TONES].sort())
  })

  it('gives every tone both halves of its colour pair', () => {
    for (const tone of CALLOUT_TONES) {
      const body = dressed.get(tone) ?? ''
      expect(body, `[data-callout="${tone}"] declares no border colour`).toMatch(
        /border-inline-start-color:\s*var\(--kern-[a-z0-9-]+\)/,
      )
      expect(body, `[data-callout="${tone}"] declares no background`).toMatch(
        /background:\s*var\(--kern-[a-z0-9-]+\)/,
      )
    }
  })

  it('narrows anything outside the set to the default, and never a valid tone', () => {
    expect(calloutTone('nonsense')).toBe(DEFAULT_CALLOUT_TONE)
    expect(calloutTone(undefined)).toBe(DEFAULT_CALLOUT_TONE)
    for (const tone of CALLOUT_TONES) expect(calloutTone(tone)).toBe(tone)
  })
})
