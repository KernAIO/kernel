import { z } from 'zod'
import { Timestamp } from '../common.js'
import { ModuleId, ObjectRef, WorkspaceId } from '../ids.js'
import { PermissionKey, PermissionScope } from '../permissions.js'

export const SearchHit = z.object({
  object: ObjectRef,
  title: z.string(),
  snippet: z.string().nullable(),
  url: z.string(),
  icon: z.string().nullable(),
  score: z.number(),
  updatedAt: Timestamp.nullable(),
})
export type SearchHit = z.infer<typeof SearchHit>

export const SearchInput = z.object({
  workspaceId: WorkspaceId,
  q: z.string().min(1).max(200),
  modules: z.array(ModuleId).optional(),
  types: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  semantic: z.boolean().default(false),
})

/** Document shape modules index into the search provider. */
export const SearchDocument = z.object({
  workspaceId: WorkspaceId,
  object: ObjectRef,
  title: z.string(),
  body: z.string().nullable(),
  url: z.string(),
  icon: z.string().nullable().default(null),
  /** visibility: who may see this hit (workspace-wide or restricted to these member/group ids) */
  acl: z.array(z.string()).nullable().default(null),
  /**
   * The permission the search host must be able to prove before it shows this hit, and the scope to
   * prove it at — resolved through `kernel.authz.can`, which is the one place that understands a
   * **deny** binding.
   *
   * `acl` cannot express one. It is an additive set overlap (`acl && subjects`), so there is no
   * string a module can add to it that *removes* a subject: an administrator who denies
   * `tracker.project.view` for one person on one project gets a refusal from the module's own
   * procedures and a hit in search carrying the title and the indexed body. Measured 2026-09-06.
   *
   * The two fields are **both** applied and neither replaces the other, which is worth stating
   * because the overlap is not obvious. `acl` is the only thing that knows a *readership* — the
   * member list of a private tracker project or a private chat channel — and `can()` cannot
   * reconstruct it, because a narrow-scope check with no binding falls through to the caller's
   * workspace-level set and answers true. `authz` is the only thing that knows a *decision* an
   * administrator made. A hit has to clear both.
   *
   * Optional on purpose (`.nullish()`, so it is absent rather than required at every construction
   * site): a document indexed without one is filtered by `acl` alone, exactly as before, which is
   * what keeps a rolling deploy honest in both directions.
   *
   * A permission key the search host's own process does not know cannot be resolved, and an
   * unresolvable document is **withheld**. Declare this only for a module the search host registers.
   */
  authz: z.object({ permission: PermissionKey, scope: PermissionScope }).nullish(),
  updatedAt: Timestamp,
  attributes: z.record(z.string(), z.unknown()).default({}),
})
export type SearchDocument = z.infer<typeof SearchDocument>
