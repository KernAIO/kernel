import { z } from 'zod'

/**
 * A capability is a named sub-feature of a module that a workspace can switch off on its own.
 *
 * A module is the coarse unit — chat, the tracker, HR — and turning one off removes all of it. That
 * is too blunt for a module whose customers want different amounts of it: an HR module where one
 * company uses only check-in and another uses leave, accruals and rosters would otherwise be either
 * a code fork or a screen full of things that do nothing. A capability is the finer switch, and it
 * carries its dependencies so the answer to "what does turning this off take with it" is data rather
 * than a comment.
 *
 * Two rules make it worth having rather than being a second permission system:
 *
 * - **A permission is about a person; a capability is about a workspace.** "May Ayşe approve leave"
 *   is a permission. "Does this company do leave at all" is a capability. A disabled capability is
 *   `notFound` to everyone including the owner, because the surface is not there — where a missing
 *   permission is `forbidden` to one person and fine for the next.
 * - **Turning one off never destroys data.** It is a flag in the module's settings; the rows stay
 *   exactly where they were, and turning it back on restores what was there. Anything that would
 *   need a migration to reverse does not belong behind a capability.
 */
export const CapabilityId = z.string().regex(/^[a-z][a-z0-9_]*$/)
export type CapabilityId = z.infer<typeof CapabilityId>

export const CapabilityDef = z.object({
  /** unique within the module; namespaced as `<moduleId>.<id>` everywhere outside it */
  id: CapabilityId,
  /** i18n message id or English fallback, like `PermissionDef.label` */
  label: z.string(),
  description: z.string().optional(),
  /**
   * Capabilities that must be on for this one to mean anything. Switching a dependency off switches
   * this off with it — `resolveCapabilities` computes that closure, so nothing has to remember it.
   */
  dependsOn: z.array(CapabilityId).default([]),
  /** on for a workspace that has never touched the switchboard */
  defaultEnabled: z.boolean().default(false),
  /**
   * Roughly how much of the module this belongs to: 1 is what nearly everyone wants and needs no
   * configuration, 3 is what a large organisation asks for. Only used to order and group the
   * switchboard — nothing behaves differently because of it.
   */
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  /**
   * Always on, not offered as a switch. The module's own foundation: the thing every other
   * capability depends on and that turning off would leave nothing behind.
   */
  required: z.boolean().default(false),
})
export type CapabilityDef = z.infer<typeof CapabilityDef>

/** Input shape (defaults not yet applied), for authoring a registry. */
export type CapabilityDefInput = z.input<typeof CapabilityDef>

/**
 * Declare a module's capabilities. Validates at import time, the way `definePermissions` does, so a
 * typo in a `dependsOn` fails when the module loads rather than when somebody flips a switch.
 */
export function defineCapabilities<const T extends readonly CapabilityDefInput[]>(
  defs: T,
): ReadonlyArray<CapabilityDef> {
  const parsed = defs.map((d) => CapabilityDef.parse(d))
  const ids = new Set(parsed.map((d) => d.id))
  for (const d of parsed) {
    for (const dep of d.dependsOn) {
      if (!ids.has(dep)) throw new Error(`Capability "${d.id}" depends on unknown capability "${dep}"`)
      if (dep === d.id) throw new Error(`Capability "${d.id}" depends on itself`)
    }
  }
  assertNoCycle(parsed)
  return parsed
}

function assertNoCycle(defs: readonly CapabilityDef[]): void {
  const byId = new Map(defs.map((d) => [d.id, d]))
  const state = new Map<string, 'visiting' | 'done'>()
  const walk = (id: string, trail: string[]): void => {
    if (state.get(id) === 'done') return
    if (state.get(id) === 'visiting')
      throw new Error(`Capability dependency cycle: ${[...trail, id].join(' → ')}`)
    state.set(id, 'visiting')
    for (const dep of byId.get(id)?.dependsOn ?? []) walk(dep, [...trail, id])
    state.set(id, 'done')
  }
  for (const d of defs) walk(d.id, [])
}

/**
 * What is actually on, given what the workspace stored.
 *
 * Three things happen here, and they are the reason this is one function rather than a `Set` built
 * at each call site:
 *
 * 1. a capability nobody has an opinion about falls back to `defaultEnabled`;
 * 2. `required` is on whatever anyone stored;
 * 3. a capability whose dependency is off is off, transitively — switching `attendance` off takes
 *    `overtime` and `rosters` with it without either of them being mentioned.
 *
 * Stored keys the module no longer declares are ignored rather than carried, so removing a
 * capability in a release does not leave a workspace holding a flag for something that is gone.
 */
export function resolveCapabilities(
  defs: readonly CapabilityDef[],
  stored: Record<string, boolean> | null | undefined,
): Set<CapabilityId> {
  const byId = new Map(defs.map((d) => [d.id, d]))
  const on = new Set<CapabilityId>()
  for (const d of defs) {
    if (d.required || (stored?.[d.id] ?? d.defaultEnabled)) on.add(d.id)
  }
  // Prune until stable: dropping one can drop another that depended on it.
  for (let pass = 0; pass < defs.length + 1; pass++) {
    let changed = false
    for (const id of [...on]) {
      const def = byId.get(id)
      if (!def || def.required) continue
      if (def.dependsOn.some((dep) => !on.has(dep))) {
        on.delete(id)
        changed = true
      }
    }
    if (!changed) break
  }
  return on
}

/**
 * Everything that would go off with `id`, itself included — what a confirmation dialog has to name
 * before somebody switches something off and finds two other screens gone.
 */
export function capabilityDependents(defs: readonly CapabilityDef[], id: CapabilityId): CapabilityId[] {
  const out = new Set<CapabilityId>([id])
  let changed = true
  while (changed) {
    changed = false
    for (const d of defs) {
      if (out.has(d.id)) continue
      if (d.dependsOn.some((dep) => out.has(dep))) {
        out.add(d.id)
        changed = true
      }
    }
  }
  return [...out]
}

/** `<moduleId>.<capabilityId>` — how a capability is named anywhere outside its own module. */
export const capabilityKey = (moduleId: string, id: CapabilityId) => `${moduleId}.${id}`
