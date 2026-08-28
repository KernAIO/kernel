import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PAGE_DOC_READING_MACROS } from '../page-doc.js'
import {
  CHILDREN_SORTS,
  childrenSort,
  DEFAULT_CHILDREN_SORT,
  DEFAULT_RECENT_SCOPE,
  DEFAULT_STATUS_TONE,
  MAX_CHILDREN_DEPTH,
  MAX_MACRO_ROWS,
  macroCount,
  macroFlag,
  macroNodes,
  macroPageId,
  RECENT_SCOPES,
  recentScope,
  STATUS_TONES,
  statusTone,
} from './macros.js'

/**
 * The three claims this file makes about the macros, and each has been wrong somewhere before.
 *
 * `callout.test.ts` next door exists because `CALLOUT_TONES` and the rules in prose.css drifted —
 * five tones, four rules, and a `note` callout that rendered untinted on both sides of the wire.
 * The lozenge has exactly the same shape, so it gets exactly the same check.
 *
 * The narrowing functions get their own: the renderer in @kernhq/module-quire imports them and
 * applies the identical rule, which is only worth anything if "identical" means what it says. A
 * value that reaches an attribute selector, an `ORDER BY` or a `WHERE id = $1::uuid` has to be one
 * of a closed set on both sides or it is a defect on whichever side is more trusting.
 */

const prose = readFileSync(new URL('../../styles/prose.css', import.meta.url), 'utf8')

/** Every `.kern-status[data-status="…"]` rule in prose.css, with the declarations it carries. */
const dressed = new Map(
  [...prose.matchAll(/\.kern-status\[data-status="([a-z]+)"\]\s*\{([^}]*)\}/g)].map(
    ([, tone, body]) => [tone, body] as const,
  ),
)

describe('status tones', () => {
  it('dresses exactly the tones the extension can produce', () => {
    expect([...dressed.keys()].sort()).toEqual([...STATUS_TONES].sort())
  })

  it('gives every tone both halves of its colour pair', () => {
    for (const tone of STATUS_TONES) {
      const body = dressed.get(tone) ?? ''
      expect(body, `[data-status="${tone}"] declares no background`).toMatch(
        /background:\s*var\(--kern-[a-z0-9-]+\)/,
      )
      expect(body, `[data-status="${tone}"] declares no text colour`).toMatch(
        /color:\s*var\(--kern-[a-z0-9-]+\)/,
      )
    }
  })

  it('narrows anything outside the set to the default, and never a valid tone', () => {
    expect(statusTone('nonsense')).toBe(DEFAULT_STATUS_TONE)
    expect(statusTone(undefined)).toBe(DEFAULT_STATUS_TONE)
    expect(statusTone('" onload="x')).toBe(DEFAULT_STATUS_TONE)
    for (const tone of STATUS_TONES) expect(statusTone(tone)).toBe(tone)
  })
})

describe('the other closed sets', () => {
  it('narrows a children sort', () => {
    expect(childrenSort('nonsense')).toBe(DEFAULT_CHILDREN_SORT)
    for (const sort of CHILDREN_SORTS) expect(childrenSort(sort)).toBe(sort)
  })

  it('narrows a recent scope', () => {
    expect(recentScope('nonsense')).toBe(DEFAULT_RECENT_SCOPE)
    for (const scope of RECENT_SCOPES) expect(recentScope(scope)).toBe(scope)
  })
})

/**
 * A page id out of a document reaches `where id = $1::uuid`.
 *
 * Anything that is not a uuid turns a macro nobody can see into a 500 on the page that holds it, so
 * it is narrowed to null here rather than passed on and hoped about — the same reason `safeInt` in
 * the renderer parses a number instead of interpolating the string it was given.
 */
describe('macroPageId', () => {
  it.each([
    'not-a-uuid',
    '',
    "01920000-0000-7000-8000-00000000000a'; drop table pages;--",
    '01920000-0000-7000-8000',
    42,
    null,
    undefined,
    {},
  ])('refuses %s', (value) => {
    expect(macroPageId(value)).toBeNull()
  })

  it('accepts a uuid and folds its case, so two spellings of one id are one id', () => {
    expect(macroPageId('01920000-0000-7000-8000-00000000000A')).toBe('01920000-0000-7000-8000-00000000000a')
  })
})

describe('macroCount', () => {
  it('clamps to the fallback outside the range, rather than to the nearest end', () => {
    // Nearest-end clamping would turn `depth: 900` into the deepest walk the server offers, which
    // is a document deciding how much work a request does.
    expect(macroCount(900, 1, MAX_CHILDREN_DEPTH, 1)).toBe(1)
    expect(macroCount(0, 1, MAX_CHILDREN_DEPTH, 1)).toBe(1)
    expect(macroCount(-3, 1, MAX_MACRO_ROWS, 10)).toBe(10)
    expect(macroCount('nonsense', 1, MAX_MACRO_ROWS, 10)).toBe(10)
    expect(macroCount(2.5, 1, MAX_MACRO_ROWS, 10)).toBe(10)
  })

  it('keeps a number inside the range, including one written as a string attribute', () => {
    expect(macroCount(3, 1, MAX_CHILDREN_DEPTH, 1)).toBe(3)
    expect(macroCount('3', 1, MAX_CHILDREN_DEPTH, 1)).toBe(3)
  })
})

describe('macroFlag', () => {
  it('is true for the boolean and for the string an HTML attribute carries, and nothing else', () => {
    expect(macroFlag(true)).toBe(true)
    expect(macroFlag('true')).toBe(true)
    expect(macroFlag('false')).toBe(false)
    expect(macroFlag(1)).toBe(false)
    expect(macroFlag(undefined)).toBe(false)
  })
})

describe('the node list', () => {
  it('is the eight macros, each named once', () => {
    const names = macroNodes.map((n) => n.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names.sort()).toEqual([
      'contributors',
      'excerpt',
      'excerptInclude',
      'expand',
      'includePage',
      'pageChildren',
      'recentlyUpdated',
      'statusLozenge',
    ])
  })

  /**
   * The three that are *not* reading macros, stated as a claim rather than left to be read off a
   * list. A macro that resolves to what is already in the document is safe on a page with no reader
   * at all; one that reads other pages is the thing the whole permission rule exists for, and
   * mistaking one for the other is how a private title reaches a public site.
   */
  it('calls exactly the macros that read other pages reading macros', () => {
    const reading = new Set<string>(PAGE_DOC_READING_MACROS)
    expect([...reading].sort()).toEqual([
      'contributors',
      'excerptInclude',
      'includePage',
      'pageChildren',
      'recentlyUpdated',
    ])
    for (const name of ['excerpt', 'expand', 'statusLozenge'])
      expect(reading.has(name), `${name} resolves from the document and must not need an audience`).toBe(
        false,
      )
    for (const name of reading) expect(macroNodes.map((n) => n.name)).toContain(name)
  })
})
