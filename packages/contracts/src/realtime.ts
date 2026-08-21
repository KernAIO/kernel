import { z } from 'zod'
import { Id, UserId, WorkspaceId } from './ids.js'
import { EntityChange } from './events.js'

/** ---- client → server ---- */
export const ClientMessage = z.discriminatedUnion('t', [
  z.object({ t: z.literal('hello'), token: z.string(), clientId: z.string(), since: z.number().int().optional() }),
  z.object({ t: z.literal('sub'), channels: z.array(z.string()).max(500) }),
  z.object({ t: z.literal('unsub'), channels: z.array(z.string()).max(500) }),
  z.object({ t: z.literal('typing'), channelId: Id, workspaceId: WorkspaceId, threadId: Id.optional() }),
  z.object({ t: z.literal('presence'), status: z.enum(['online', 'away', 'dnd', 'offline']) }),
  z.object({ t: z.literal('ack'), seq: z.number().int() }),
  z.object({ t: z.literal('ping') }),
])
export type ClientMessage = z.infer<typeof ClientMessage>

/** ---- server → client ---- */
export const ServerMessage = z.discriminatedUnion('t', [
  z.object({ t: z.literal('welcome'), userId: UserId, serverTime: z.number(), resumed: z.boolean() }),
  z.object({ t: z.literal('change'), seq: z.number().int(), workspaceId: WorkspaceId, change: EntityChange }),
  z.object({ t: z.literal('event'), seq: z.number().int(), workspaceId: WorkspaceId.nullable(), name: z.string(), payload: z.unknown() }),
  z.object({ t: z.literal('notification'), seq: z.number().int(), notification: z.unknown() }),
  z.object({ t: z.literal('badge'), workspaceId: WorkspaceId, unread: z.number().int(), mentions: z.number().int() }),
  z.object({ t: z.literal('typing'), channelId: Id, workspaceId: WorkspaceId, userId: UserId, threadId: Id.optional(), at: z.number() }),
  z.object({ t: z.literal('presence'), userId: UserId, status: z.enum(['online', 'away', 'dnd', 'offline']), lastSeen: z.number().optional() }),
  z.object({ t: z.literal('error'), code: z.string(), message: z.string() }),
  z.object({ t: z.literal('pong') }),
])
export type ServerMessage = z.infer<typeof ServerMessage>

/**
 * Subscription channel naming used by clients and publishers:
 *   ws:<workspaceId>                 – all entity changes in a workspace
 *   ws:<workspaceId>:<module>:<id>   – a specific object (e.g. issue detail open)
 *   chat:<channelId>                 – chat channel stream (messages, typing)
 *   user:<userId>                    – private (notifications, badges) – auto-subscribed
 */
export const channel = {
  workspace: (ws: string) => `ws:${ws}`,
  object: (ws: string, module: string, id: string) => `ws:${ws}:${module}:${id}`,
  chat: (channelId: string) => `chat:${channelId}`,
  user: (userId: string) => `user:${userId}`,
}
