/**
 * The contract between the `collab` service and the modules whose objects it edits.
 *
 * Collaborative rich text is a Yjs document synchronised through Hocuspocus. The service owns no
 * domain data: it authenticates against core, asks the owning module whether the user may read or
 * write, and persists the merged state. Every shape that crosses that boundary is declared here so
 * that the gateway and the module compile against one definition — the first implementation of
 * `collab.access` was written against a different signature from the one the gateway calls, so it
 * never once succeeded and the gateway silently fell back to plain workspace membership.
 */
import { z } from 'zod'
import { Timestamp } from './common.js'
import { defineEvent } from './events.js'
import { Id, ModuleId, UserId, WorkspaceId } from './ids.js'

/** `ws:<workspaceId>:<module>:<type>:<id>`, e.g. `ws:0192…:quire:page:0192…`. */
export const CollabDocument = z.object({
  workspaceId: WorkspaceId,
  module: ModuleId,
  /** the module's own object type, e.g. `page` */
  type: z.string().min(1).max(48),
  objectId: Id,
})
export type CollabDocument = z.infer<typeof CollabDocument>

export function formatCollabDocument(d: CollabDocument): string {
  return `ws:${d.workspaceId}:${d.module}:${d.type}:${d.objectId}`
}

/**
 * Returns `null` rather than throwing: the name arrives from a WebSocket client, so a malformed one
 * is a rejected connection, not an exception to propagate.
 */
export function parseCollabDocument(name: string): CollabDocument | null {
  const parts = name.split(':')
  if (parts.length !== 5 || parts[0] !== 'ws') return null
  const [, workspaceId, module, type, objectId] = parts
  if (!workspaceId || !module || !type || !objectId) return null
  const parsed = CollabDocument.safeParse({ workspaceId, module, type, objectId })
  return parsed.success ? parsed.data : null
}

/** ---- `<module>.collab.access` — implemented by every module that owns collaborative content ---- */

export const CollabAccessInput = z.object({
  workspaceId: WorkspaceId,
  type: z.string().min(1).max(48),
  id: Id,
  userId: UserId,
})
export type CollabAccessInput = z.infer<typeof CollabAccessInput>

/** `canRead: false` rejects the connection; `canWrite: false` makes it read-only. */
export const CollabAccess = z.object({ canRead: z.boolean(), canWrite: z.boolean() })
export type CollabAccess = z.infer<typeof CollabAccess>

/** ---- `collab.document.*` — implemented by the collab service, called by modules ---- */

const doc = z.object({ name: z.string().min(1) })

/** Yjs state is binary and the broker speaks JSON, so states cross this boundary base64-encoded. */
export const CollabDocumentState = z.object({
  name: z.string(),
  /** `Y.encodeStateAsUpdate(doc)`, base64. `null` when the document has never been stored. */
  state: z.base64().nullable(),
  size: z.number().int().nonnegative(),
  updatedAt: Timestamp.nullable(),
})
export type CollabDocumentState = z.infer<typeof CollabDocumentState>

export const collabProcedures = {
  /** Read the merged state, for versioning, export or rendering a page nobody has open. */
  'document.state': { input: doc, output: CollabDocumentState },
  /** Apply an update server-side — restoring a version, instantiating a template, importing. */
  'document.apply': {
    input: doc.extend({ update: z.base64() }),
    output: z.object({ ok: z.literal(true), size: z.number().int().nonnegative() }),
  },
  /**
   * Make the document's content equal the given state.
   *
   * Not the same as `document.apply`, and the difference is the whole reason this exists: applying
   * an update *merges* it, so feeding an old version back produces the union of old and new rather
   * than the old one. Restoring a version means replacing, and replacing has to happen where the
   * CRDT is understood rather than in every module that keeps history.
   */
  'document.replace': {
    input: doc.extend({ state: z.base64() }),
    output: z.object({ ok: z.literal(true), size: z.number().int().nonnegative() }),
  },
  /** A `Y.snapshot` of the current state, for version history and diffs. */
  'document.snapshot': { input: doc, output: z.object({ snapshot: z.base64(), state: z.base64() }) },
  /** Forget a document whose object was deleted. Nothing else removes these rows. */
  'document.delete': { input: doc, output: z.object({ ok: z.literal(true) }) },
  /** Who has this document open right now, from Hocuspocus awareness. */
  'document.presence': {
    input: doc,
    output: z.object({
      users: z.array(z.object({ userId: UserId, name: z.string(), readOnly: z.boolean() })),
      connections: z.number().int().nonnegative(),
    }),
  },
} as const

export const collabEvents = {
  /**
   * A plain-text export published while a document is being edited, throttled per document, so a
   * module can index prose for search without decoding the CRDT.
   *
   * `name` and `updatedAt` are optional for the same reason as `core.file.ready`'s `size`: during a
   * rolling deploy an older collab publishes without them, and a subscriber that validated them as
   * required would drop the event rather than index the text. Fall back to the envelope's
   * `occurredAt` and to `formatCollabDocument`.
   */
  documentUpdated: defineEvent(
    'collab.document.updated',
    z.object({
      name: z.string().optional(),
      workspaceId: WorkspaceId,
      module: ModuleId,
      type: z.string(),
      objectId: Id,
      text: z.string(),
      updatedAt: Timestamp.optional(),
    }),
  ),
} as const
