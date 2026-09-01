import { describe, expect, it } from 'vitest'
import {
  BUILTIN_ROLE_ORDER,
  effectiveDefaultMatrix,
  type PermissionLike,
  permissionMatrixDiff,
} from './permission-matrix.js'

const defs: readonly PermissionLike[] = [
  { key: 'demo.issue.read', defaultRoles: ['guest'] },
  { key: 'demo.issue.create', defaultRoles: ['member'] },
  { key: 'demo.issue.assign', defaultRoles: ['admin'] },
  { key: 'demo.issue.delete', defaultRoles: ['owner'] },
  { key: 'demo.issue.export', defaultRoles: [] },
]

const blessed = {
  'demo.issue.read': ['guest', 'member', 'admin', 'owner'],
  'demo.issue.create': ['member', 'admin', 'owner'],
  'demo.issue.assign': ['admin', 'owner'],
  'demo.issue.delete': ['owner'],
  'demo.issue.export': [],
}

describe('BUILTIN_ROLE_ORDER', () => {
  it('is the kernel rank order, lowest first', () => {
    expect(BUILTIN_ROLE_ORDER).toEqual(['guest', 'member', 'admin', 'owner'])
  })
})

describe('effectiveDefaultMatrix', () => {
  it('cascades each declared role upward', () => {
    expect(effectiveDefaultMatrix(defs)).toEqual(blessed)
  })

  it('lists roles in role order whatever order they were declared in', () => {
    const matrix = effectiveDefaultMatrix([{ key: 'demo.a.b', defaultRoles: ['owner', 'member'] }])
    expect(matrix['demo.a.b']).toEqual(['member', 'admin', 'owner'])
  })

  it('treats a missing defaultRoles as no grant', () => {
    expect(effectiveDefaultMatrix([{ key: 'demo.a.b' }])).toEqual({ 'demo.a.b': [] })
  })

  it('ignores a role that is not in the role order', () => {
    expect(effectiveDefaultMatrix([{ key: 'demo.a.b', defaultRoles: ['Owner'] }])).toEqual({
      'demo.a.b': [],
    })
  })

  it('unions repeated declarations of one key, like the kernel does', () => {
    const matrix = effectiveDefaultMatrix([
      { key: 'demo.a.b', defaultRoles: ['owner'] },
      { key: 'demo.a.b', defaultRoles: ['member'] },
    ])
    expect(matrix['demo.a.b']).toEqual(['member', 'admin', 'owner'])
  })

  it('returns an empty matrix for no definitions', () => {
    expect(effectiveDefaultMatrix([])).toEqual({})
  })

  it('follows a custom role order', () => {
    const matrix = effectiveDefaultMatrix(
      [{ key: 'demo.a.b', defaultRoles: ['staff'] }],
      ['staff', 'manager'],
    )
    expect(matrix['demo.a.b']).toEqual(['staff', 'manager'])
  })
})

describe('permissionMatrixDiff', () => {
  it('reports nothing when the matrix matches', () => {
    expect(permissionMatrixDiff(defs, blessed)).toEqual([])
  })

  it('reports nothing for no definitions and no expectations', () => {
    expect(permissionMatrixDiff([], {})).toEqual([])
  })

  it('names the role that is granted but not blessed', () => {
    const diff = permissionMatrixDiff(defs, { ...blessed, 'demo.issue.create': ['admin', 'owner'] })
    expect(diff).toEqual(['demo.issue.create: member expected deny, declared allow'])
  })

  it('names the role that is blessed but not granted', () => {
    const diff = permissionMatrixDiff(defs, { ...blessed, 'demo.issue.delete': ['admin', 'owner'] })
    expect(diff).toEqual(['demo.issue.delete: admin expected allow, declared deny'])
  })

  it('collects every mismatch rather than stopping at the first', () => {
    const diff = permissionMatrixDiff(defs, {
      ...blessed,
      'demo.issue.assign': ['guest'],
      'demo.issue.delete': [],
    })
    expect(diff).toEqual([
      'demo.issue.assign: guest expected allow, declared deny',
      'demo.issue.assign: admin expected deny, declared allow',
      'demo.issue.assign: owner expected deny, declared allow',
      'demo.issue.delete: owner expected deny, declared allow',
    ])
  })

  it('compares the blessed roles as a set, not as a list', () => {
    const diff = permissionMatrixDiff(defs, {
      ...blessed,
      'demo.issue.create': ['owner', 'admin', 'member'],
    })
    expect(diff).toEqual([])
  })

  it('reports a declared permission that is missing from the expected matrix', () => {
    const { 'demo.issue.export': _dropped, ...partial } = blessed
    const diff = permissionMatrixDiff(defs, partial)
    expect(diff).toEqual([
      expect.stringContaining('demo.issue.export: declared but missing from the expected matrix'),
    ])
  })

  it('reports an expected key that nothing declares', () => {
    const diff = permissionMatrixDiff(defs, { ...blessed, 'demo.issue.archive': ['owner'] })
    expect(diff).toEqual([
      expect.stringContaining('demo.issue.archive: present in the expected matrix but not declared'),
    ])
  })

  it('reports a duplicate key once, with its count', () => {
    const diff = permissionMatrixDiff(
      [
        { key: 'demo.a.b', defaultRoles: ['member'] },
        { key: 'demo.a.b', defaultRoles: ['member'] },
      ],
      { 'demo.a.b': ['member', 'admin', 'owner'] },
    )
    expect(diff).toEqual(['demo.a.b: declared 2 times; permission keys must be unique'])
  })

  it('reports a declared role that is not a known role', () => {
    const diff = permissionMatrixDiff([{ key: 'demo.a.b', defaultRoles: ['Owner'] }], {
      'demo.a.b': ['owner'],
    })
    expect(diff).toEqual([
      "demo.a.b: declared defaultRole 'Owner' is not a known role (guest, member, admin, owner)",
      'demo.a.b: owner expected allow, declared deny',
    ])
  })

  it('reports an unknown role name inside the expected matrix', () => {
    const diff = permissionMatrixDiff([{ key: 'demo.a.b', defaultRoles: ['owner'] }], {
      'demo.a.b': ['owner', 'Admin'],
    })
    expect(diff).toEqual([
      "demo.a.b: expected role 'Admin' is not a known role (guest, member, admin, owner)",
    ])
  })

  it('applies a custom role order to both sides', () => {
    const order = ['staff', 'manager']
    const custom: readonly PermissionLike[] = [{ key: 'demo.a.b', defaultRoles: ['staff'] }]
    expect(permissionMatrixDiff(custom, { 'demo.a.b': ['staff', 'manager'] }, order)).toEqual([])
    expect(permissionMatrixDiff(custom, { 'demo.a.b': ['staff'] }, order)).toEqual([
      'demo.a.b: manager expected deny, declared allow',
    ])
    expect(permissionMatrixDiff(custom, { 'demo.a.b': ['owner'] }, order)).toEqual([
      "demo.a.b: expected role 'owner' is not a known role (staff, manager)",
      'demo.a.b: staff expected deny, declared allow',
      'demo.a.b: manager expected deny, declared allow',
    ])
  })
})
