import { z } from 'zod'
import { ModuleId, ObjectRef, WorkspaceId } from '../ids.js'
import { Timestamp } from '../common.js'

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
  updatedAt: Timestamp,
  attributes: z.record(z.string(), z.unknown()).default({}),
})
export type SearchDocument = z.infer<typeof SearchDocument>
