import { z } from 'zod'
import { Email, Locale, Timestamp } from '../common.js'
import { UserId } from '../ids.js'

export const UserStatus = z.enum(['active', 'suspended', 'deleted'])

export const User = z.object({
  id: UserId,
  email: Email,
  name: z.string().min(1).max(120),
  username: z.string().min(2).max(48).nullable(),
  avatarUrl: z.string().url().nullable(),
  locale: Locale,
  timezone: z.string().default('UTC'),
  instanceAdmin: z.boolean().default(false),
  status: UserStatus,
  emailVerified: z.boolean(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
})
export type User = z.infer<typeof User>

/** What other members may see about a user */
export const UserPublic = User.pick({ id: true, name: true, username: true, avatarUrl: true }).extend({
  email: Email.optional(),
  title: z.string().nullable().optional(),
})
export type UserPublic = z.infer<typeof UserPublic>

export const UpdateMe = z.object({
  name: z.string().min(1).max(120).optional(),
  username: z.string().min(2).max(48).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  locale: Locale.optional(),
  timezone: z.string().optional(),
})
export type UpdateMe = z.infer<typeof UpdateMe>

export const PresenceStatus = z.enum(['online', 'away', 'dnd', 'offline'])
export const UserStatusMessage = z.object({
  emoji: z.string().max(8).nullable(),
  text: z.string().max(120).nullable(),
  clearAt: Timestamp.nullable(),
})
