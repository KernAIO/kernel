import { z } from 'zod'

/** All Kern identifiers are UUID v7 strings (time-ordered). */
export const Id = z.uuid()
export type Id = z.infer<typeof Id>

export const UserId = Id.brand<'UserId'>()
export type UserId = z.infer<typeof UserId>
export const WorkspaceId = Id.brand<'WorkspaceId'>()
export type WorkspaceId = z.infer<typeof WorkspaceId>
export const MembershipId = Id.brand<'MembershipId'>()
export type MembershipId = z.infer<typeof MembershipId>

/** Lowercase URL-safe handle: workspace slugs, project keys (upper), usernames. */
export const Slug = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'lowercase letters, digits and dashes')
export type Slug = z.infer<typeof Slug>

/** Module identifier, e.g. `tracker`, `chat`, `hr`. */
export const ModuleId = z
  .string()
  .min(2)
  .max(32)
  .regex(/^[a-z][a-z0-9_]*$/, 'lowercase identifier')
export type ModuleId = z.infer<typeof ModuleId>

/**
 * A reference to any object in any module, e.g. `tracker:issue:0190...`.
 * Used for mentions, links, object channels, activity, notifications.
 */
export const ObjectRef = z.object({
  module: ModuleId,
  type: z.string().min(1).max(48),
  id: Id,
})
export type ObjectRef = z.infer<typeof ObjectRef>
export const objectRefToString = (r: ObjectRef) => `${r.module}:${r.type}:${r.id}`
export const parseObjectRef = (s: string): ObjectRef => {
  const [module, type, id] = s.split(':')
  return ObjectRef.parse({ module, type, id })
}
