import { describe, expect, it } from 'vitest'
import { capabilityDependents, defineCapabilities, resolveCapabilities } from './capabilities.js'

/** A module shaped like HR: a required core, two independent features, two that depend on one of them. */
const DEFS = defineCapabilities([
  { id: 'core', label: 'Employee core', required: true },
  { id: 'leave', label: 'Leave', defaultEnabled: true, dependsOn: ['core'] },
  { id: 'attendance', label: 'Attendance', dependsOn: ['core'] },
  { id: 'overtime', label: 'Overtime', dependsOn: ['attendance'], level: 2 },
  { id: 'rosters', label: 'Rosters', dependsOn: ['attendance'], level: 3 },
  { id: 'accrual', label: 'Accrual', dependsOn: ['leave'], level: 2 },
])

describe('defineCapabilities', () => {
  it('rejects a dependency that does not exist', () => {
    expect(() => defineCapabilities([{ id: 'a', label: 'A', dependsOn: ['nope'] }])).toThrow(/unknown/)
  })
  it('rejects a self-dependency', () => {
    expect(() => defineCapabilities([{ id: 'a', label: 'A', dependsOn: ['a'] }])).toThrow(/itself/)
  })
  it('rejects a cycle', () => {
    expect(() =>
      defineCapabilities([
        { id: 'a', label: 'A', dependsOn: ['b'] },
        { id: 'b', label: 'B', dependsOn: ['c'] },
        { id: 'c', label: 'C', dependsOn: ['a'] },
      ]),
    ).toThrow(/cycle/)
  })
  it('applies defaults', () => {
    const [a] = defineCapabilities([{ id: 'a', label: 'A' }])
    expect(a).toMatchObject({ dependsOn: [], defaultEnabled: false, level: 1, required: false })
  })
})

describe('resolveCapabilities', () => {
  it('falls back to defaults for a workspace that stored nothing', () => {
    expect([...resolveCapabilities(DEFS, null)].sort()).toEqual(['core', 'leave'])
  })

  it('keeps a required capability on however loudly it is switched off', () => {
    expect(resolveCapabilities(DEFS, { core: false }).has('core')).toBe(true)
  })

  it('prunes transitively — switching attendance off takes overtime and rosters with it', () => {
    const on = resolveCapabilities(DEFS, { attendance: true, overtime: true, rosters: true })
    expect(on.has('overtime')).toBe(true)
    const off = resolveCapabilities(DEFS, { attendance: false, overtime: true, rosters: true })
    expect(off.has('overtime')).toBe(false)
    expect(off.has('rosters')).toBe(false)
    // and it does not take the unrelated branch with it
    expect(off.has('leave')).toBe(true)
  })

  it('prunes a chain more than one link long', () => {
    const deep = defineCapabilities([
      { id: 'a', label: 'A', defaultEnabled: true },
      { id: 'b', label: 'B', dependsOn: ['a'], defaultEnabled: true },
      { id: 'c', label: 'C', dependsOn: ['b'], defaultEnabled: true },
      { id: 'd', label: 'D', dependsOn: ['c'], defaultEnabled: true },
    ])
    expect([...resolveCapabilities(deep, { a: false })]).toEqual([])
  })

  it('ignores a stored key the module no longer declares', () => {
    // A capability removed in a release leaves its flag behind in every workspace's settings.
    const on = resolveCapabilities(DEFS, { gone: true, attendance: true })
    expect(on.has('gone' as never)).toBe(false)
    expect(on.has('attendance')).toBe(true)
  })

  it('is empty for a module that declares nothing', () => {
    expect(resolveCapabilities([], { anything: true }).size).toBe(0)
  })
})

describe('capabilityDependents', () => {
  it('names everything that would go off with it, itself included', () => {
    expect(capabilityDependents(DEFS, 'attendance').sort()).toEqual(['attendance', 'overtime', 'rosters'])
  })
  it('is just itself for a leaf', () => {
    expect(capabilityDependents(DEFS, 'rosters')).toEqual(['rosters'])
  })
  it('reaches the whole module from the root', () => {
    expect(capabilityDependents(DEFS, 'core')).toHaveLength(DEFS.length)
  })
})
