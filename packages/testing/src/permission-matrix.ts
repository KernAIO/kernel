/**
 * Permission matrix helpers.
 *
 * A module declares permission defaults next to the permission itself, which makes the *whole*
 * picture — who ends up with what — impossible to read from any single line. These helpers compute
 * that picture and compare it against a matrix the module blesses explicitly, so a change to a
 * default has to be stated twice: once where it is declared and once where it is agreed.
 *
 * The helpers are structural on purpose: they take anything with a `key` and `defaultRoles`, so a
 * module can pass its `definePermissions([...])` tuple straight in without this package depending
 * on `@kernhq/contracts`.
 */

/** Structural subset of `@kernhq/contracts` `PermissionDef` — zero new dependencies on purpose. */
export interface PermissionLike {
  key: string
  defaultRoles?: readonly string[]
}

/**
 * The kernel's built-in role rank order, lowest first. Every role inherits the defaults of every
 * role below it, so position in this list is what the cascade walks.
 */
export const BUILTIN_ROLE_ORDER: readonly string[] = ['guest', 'member', 'admin', 'owner']

/** Roles a permission is granted to by default, after the cascade, in `roleOrder` order. */
function grantedRoles(defaultRoles: readonly string[], roleOrder: readonly string[]): Set<string> {
  const granted = new Set<string>()
  for (const role of defaultRoles) {
    const from = roleOrder.indexOf(role)
    // An unknown role grants nothing; `permissionMatrixDiff` is what reports it.
    if (from < 0) continue
    for (let i = from; i < roleOrder.length; i++) {
      const higher = roleOrder[i]
      if (higher !== undefined) granted.add(higher)
    }
  }
  return granted
}

/**
 * Effective default grant per permission after the kernel's cumulative cascade
 * (guest ⊆ member ⊆ admin ⊆ owner). Returns `Record<permissionKey, sortedRoleNames[]>` where the
 * roles are listed in `roleOrder`.
 *
 * A permission with no `defaultRoles` maps to `[]`. Roles not present in `roleOrder` are ignored
 * here rather than thrown on, so a typo shows up as a mismatch in `permissionMatrixDiff` with a
 * message naming it, instead of as an exception with no matrix at all.
 *
 * Repeated keys are unioned, which is what `Authz.registerPermissions` does — it adds each
 * declaration's roles to the same key. `permissionMatrixDiff` reports the repeat separately.
 */
export function effectiveDefaultMatrix(
  defs: readonly PermissionLike[],
  roleOrder: readonly string[] = BUILTIN_ROLE_ORDER,
): Record<string, string[]> {
  const granted = new Map<string, Set<string>>()
  for (const def of defs) {
    const roles = granted.get(def.key) ?? new Set<string>()
    for (const role of grantedRoles(def.defaultRoles ?? [], roleOrder)) roles.add(role)
    granted.set(def.key, roles)
  }
  const matrix: Record<string, string[]> = {}
  for (const [key, roles] of granted) matrix[key] = roleOrder.filter((r) => roles.has(r))
  return matrix
}

/**
 * Compare declared permission defaults against a blessed matrix.
 *
 * Returns human-readable mismatch descriptions; an empty array means the matrix matches. Every
 * mismatch is collected — the function never fails fast — so one assertion shows the whole diff.
 *
 * `expected[key]` is the full set of roles that end up allowed, cascade included and order
 * insensitive: a permission declaring `defaultRoles: ['member']` is blessed as
 * `['member', 'admin', 'owner']`, not as `['member']`. Writing out the whole row is the point —
 * it is what makes "guest can read this" something a reader can check rather than derive.
 *
 * Messages are prefixed with the permission key so a test can grep for one:
 *
 * ```
 * tracker.issue.delete: guest expected deny, declared allow
 * ```
 */
export function permissionMatrixDiff(
  defs: readonly PermissionLike[],
  expected: Readonly<Record<string, readonly string[]>>,
  roleOrder: readonly string[] = BUILTIN_ROLE_ORDER,
): string[] {
  const problems: string[] = []
  const knownRoles = new Set(roleOrder)
  const roleList = roleOrder.join(', ')

  const seen = new Map<string, number>()
  for (const def of defs) seen.set(def.key, (seen.get(def.key) ?? 0) + 1)
  for (const [key, count] of seen)
    if (count > 1) problems.push(`${key}: declared ${count} times; permission keys must be unique`)

  const effective = effectiveDefaultMatrix(defs, roleOrder)

  // Declaration order, deduplicated: one report per key however often it was declared.
  for (const key of seen.keys()) {
    for (const def of defs) {
      if (def.key !== key) continue
      for (const role of def.defaultRoles ?? [])
        if (!knownRoles.has(role))
          problems.push(`${key}: declared defaultRole '${role}' is not a known role (${roleList})`)
    }

    const blessed = expected[key]
    if (!blessed) {
      problems.push(
        `${key}: declared but missing from the expected matrix; add it there deliberately so a new permission is a decision, not a default`,
      )
      continue
    }

    const allowed = new Set<string>()
    for (const role of blessed) {
      if (knownRoles.has(role)) allowed.add(role)
      else problems.push(`${key}: expected role '${role}' is not a known role (${roleList})`)
    }

    const granted = new Set(effective[key] ?? [])
    for (const role of roleOrder) {
      const wanted = allowed.has(role)
      const actual = granted.has(role)
      if (wanted === actual) continue
      problems.push(
        wanted
          ? `${key}: ${role} expected allow, declared deny`
          : `${key}: ${role} expected deny, declared allow`,
      )
    }
  }

  for (const key of Object.keys(expected))
    if (!seen.has(key))
      problems.push(
        `${key}: present in the expected matrix but not declared; the permission was renamed or removed, so update the blessed entry deliberately`,
      )

  return problems
}
