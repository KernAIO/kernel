import { z } from 'zod'
import { Id, UserId, WorkspaceId } from '../ids.js'

/**
 * Personal API keys: a member's own credential for calling the ordinary REST API directly, the way
 * a CI script or a personal automation would — as opposed to MCP, which is a third-party client
 * acting through a consent. A key is scoped to one workspace and to `read` or `read_write`; nothing
 * about a key is per-module, unlike an MCP token's `<module>:read` scopes, because a raw API key has
 * no consent screen to show a breakdown on.
 */
export const ApiKeyScope = z.enum(['read', 'read_write'])
export type ApiKeyScope = z.infer<typeof ApiKeyScope>

/** What the owner (or an admin) sees about a key. Never the key itself, which is shown once. */
export const ApiKeyInfo = z.object({
  id: Id,
  name: z.string(),
  /** first few characters of the real key, for telling two keys apart in a list */
  start: z.string().nullable(),
  scope: ApiKeyScope,
  workspaceId: WorkspaceId,
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
})
export type ApiKeyInfo = z.infer<typeof ApiKeyInfo>

/** The admin oversight view adds who a key belongs to — `apiKeys.list` never needs this, it is always "mine". */
export const ApiKeyAdminInfo = ApiKeyInfo.extend({
  userId: UserId,
  userName: z.string(),
})
export type ApiKeyAdminInfo = z.infer<typeof ApiKeyAdminInfo>
