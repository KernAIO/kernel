import { z } from 'zod'
import { Timestamp } from '../common.js'
import { Id, ObjectRef, UserId, WorkspaceId } from '../ids.js'

export const FileObject = z.object({
  id: Id,
  workspaceId: WorkspaceId,
  name: z.string().max(255),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  /** storage key in the bucket */
  key: z.string(),
  sha256: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  durationMs: z.number().int().nullable(),
  thumbnailKey: z.string().nullable(),
  /** owning object (issue, message, doc…) */
  attachedTo: ObjectRef.nullable(),
  uploadedBy: UserId,
  status: z.enum(['pending', 'ready', 'failed', 'deleted']),
  createdAt: Timestamp,
})
export type FileObject = z.infer<typeof FileObject>

export const CreateUpload = z.object({
  workspaceId: WorkspaceId,
  name: z.string().max(255),
  mimeType: z.string(),
  size: z.number().int().positive(),
  attachedTo: ObjectRef.optional(),
})
export const UploadTicket = z.object({
  file: FileObject,
  /** presigned PUT for small files; tus endpoint for large */
  method: z.enum(['put', 'tus']),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).default({}),
  expiresAt: Timestamp,
})
