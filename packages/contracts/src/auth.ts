import { z } from 'zod'
import { BuiltinRole } from './permissions.js'
import { UserId, WorkspaceId } from './ids.js'
import { Locale } from './common.js'

/** Claims carried in Kern-issued JWTs (verified by every service via core's JWKS). */
export const JwtClaims = z.object({
  sub: UserId,
  email: z.string().email(),
  name: z.string().optional(),
  /** instance administrator */
  adm: z.boolean().optional(),
  /** session id */
  sid: z.string().optional(),
  /** API key id when authenticated with a token instead of a session */
  akid: z.string().optional(),
  /** permission version — bumped when any membership/role changes for this user */
  pv: z.number().int().default(0),
  iat: z.number(),
  exp: z.number(),
  iss: z.string(),
  aud: z.string().or(z.array(z.string())).optional(),
})
export type JwtClaims = z.infer<typeof JwtClaims>

export const MembershipSummary = z.object({
  workspaceId: WorkspaceId,
  role: BuiltinRole,
  /** custom role ids in addition to the builtin role */
  roleIds: z.array(z.string()).default([]),
  groupIds: z.array(z.string()).default([]),
  status: z.enum(['active', 'invited', 'suspended']).default('active'),
})
export type MembershipSummary = z.infer<typeof MembershipSummary>

/** The authenticated principal attached to every request. */
export const Principal = z.object({
  kind: z.enum(['user', 'api_key', 'service', 'anonymous']),
  userId: UserId.nullable(),
  email: z.string().nullable(),
  name: z.string().nullable(),
  locale: Locale.default('en'),
  instanceAdmin: z.boolean().default(false),
  /** service name for service→service calls, e.g. `chat` */
  service: z.string().nullable().default(null),
  memberships: z.array(MembershipSummary).default([]),
  permissionVersion: z.number().int().default(0),
})
export type Principal = z.infer<typeof Principal>

export const ANONYMOUS: Principal = {
  kind: 'anonymous',
  userId: null,
  email: null,
  name: null,
  locale: 'en',
  instanceAdmin: false,
  service: null,
  memberships: [],
  permissionVersion: 0,
}
