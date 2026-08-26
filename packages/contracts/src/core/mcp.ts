import { z } from 'zod'
import { Id, UserId, WorkspaceId } from '../ids.js'

/**
 * Model Context Protocol (MCP): the surface that lets an AI client — Claude, Cursor, an agent —
 * call a workspace's API as tools.
 *
 * The shape of this file is small on purpose. Tools are **not** declared anywhere: every module's
 * OpenAPI document is turned into tools at request time, so a module that ships a procedure has
 * shipped its tool too, with no MCP-specific code in any module. What needs an explicit model is
 * only what a person decides on: which client may connect (an OAuth client), what a user consented
 * to (a grant), and what is live right now (tokens).
 */

/** `<module>:read` or `<module>:write` — coarse, derived from each operation's HTTP method. */
export const McpScope = z.string().regex(/^[a-z][a-z0-9_]*:(read|write)$/)
export type McpScope = z.infer<typeof McpScope>

/** An OAuth client that may ask to connect. Created by dynamic client registration. */
export const McpClient = z.object({
  clientId: z.string(),
  name: z.string(),
  clientUri: z.string().url().nullable().default(null),
  logoUri: z.string().url().nullable().default(null),
  redirectUris: z.array(z.string()),
  /** true for clients the instance itself registered (never deletable by an admin toggle) */
  firstParty: z.boolean().default(false),
  createdBy: UserId.nullable().default(null),
  createdAt: z.string(),
})
export type McpClient = z.infer<typeof McpClient>

/** A live token, as an admin or the owner sees it. Never carries the token itself. */
export const McpTokenInfo = z.object({
  id: Id,
  clientId: z.string(),
  clientName: z.string(),
  userId: UserId,
  userName: z.string(),
  workspaceId: WorkspaceId,
  scopes: z.array(McpScope),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable().default(null),
  expiresAt: z.string(),
})
export type McpTokenInfo = z.infer<typeof McpTokenInfo>

/** What the consent screen shows about a pending authorization request. */
export const McpAuthRequestInfo = z.object({
  id: z.string(),
  clientName: z.string(),
  clientUri: z.string().url().nullable().default(null),
  logoUri: z.string().url().nullable().default(null),
  scopes: z.array(McpScope),
  /** already consented before → the screen says so instead of asking again */
  returning: z.boolean().default(false),
  expiresAt: z.string(),
})
export type McpAuthRequestInfo = z.infer<typeof McpAuthRequestInfo>
