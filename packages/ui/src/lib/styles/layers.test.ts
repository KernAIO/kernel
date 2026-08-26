import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The layer scale, checked rather than trusted.
 *
 * Everything that leaves its surface is portalled to `<body>`, so one stacking context orders all
 * of it and the only thing deciding what a pointer hits is these numbers. They were invented per
 * component, and the result was a select popup at 60 under a dialog overlay at 70 — every column
 * type except Text unreachable with a mouse, in every Quire dialog, with nothing in any of the
 * files looking wrong on its own.
 *
 * So the scale lives in `tokens.css` and this reads it back: the order has to hold, and no
 * component may go back to writing a number of its own.
 */

const lib = fileURLToPath(new URL('..', import.meta.url))
const tokens = readFileSync(join(lib, 'styles/tokens.css'), 'utf8')

/** `--kern-z-*`, in the order the scale is meant to stack. */
const SCALE = [
  'anchored',
  'drawer',
  'sheet',
  'dialog',
  'command',
  'popup',
  'tooltip',
  'toast',
  'skip-link',
] as const

function layer(name: (typeof SCALE)[number]): number {
  const match = tokens.match(new RegExp(`--kern-z-${name}:\\s*(-?\\d+);`))
  if (!match) throw new Error(`tokens.css declares no --kern-z-${name}`)
  return Number(match[1])
}

/** Every file in the package that can carry a style rule. */
function styleSources(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...styleSources(path))
    else if (entry.name.endsWith('.svelte') || entry.name.endsWith('.css')) out.push(path)
  }
  return out
}

describe('the layer scale', () => {
  it('declares every layer the design system uses', () => {
    for (const name of SCALE) expect(Number.isFinite(layer(name))).toBe(true)
  })

  it('stacks in the order the scale is written in', () => {
    const values = SCALE.map(layer)
    expect(values).toEqual([...values].sort((a, b) => a - b))
    expect(new Set(values).size).toBe(values.length)
  })

  /**
   * The rule the whole scale exists for. A popup is opened *from* a surface and a surface is never
   * opened from a popup, so a menu, a select or a popover has to sit above every modal surface —
   * whichever one it was opened from.
   */
  it('puts every transient popup above every modal surface', () => {
    for (const surface of ['drawer', 'sheet', 'dialog', 'command'] as const) {
      expect(layer('popup')).toBeGreaterThan(layer(surface))
    }
    // A tooltip can describe a menu item, and a toast reports on work that outlives both.
    expect(layer('tooltip')).toBeGreaterThan(layer('popup'))
    expect(layer('toast')).toBeGreaterThan(layer('tooltip'))
  })

  /**
   * `0` and `1` are allowed: lifting something above the sibling it overlaps inside its own
   * container is not a layer, and naming it one would be worse. Anything higher is a claim about
   * where it sits in the app, and that claim belongs to the scale.
   */
  it('leaves no component inventing a layer number of its own', () => {
    const offenders: string[] = []
    for (const file of styleSources(lib)) {
      for (const match of readFileSync(file, 'utf8').matchAll(/z-index:\s*([^;}\n]+)/g)) {
        const v = (match[1] ?? '').trim()
        if (v === 'auto' || v === 'inherit' || v === '0' || v === '1') continue
        if (v.includes('--kern-z-')) continue
        offenders.push(`${file.slice(lib.length)}: z-index: ${v}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
