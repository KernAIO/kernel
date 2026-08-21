import type { EntityChange, ServerMessage } from '@kernalo/contracts'
import { channel } from '@kernalo/contracts'
import { type NatsConnection, StringCodec } from 'nats'

const sc = StringCodec()
/**
 * Publish realtime messages to connected clients. The chat service runs the WebSocket gateway and
 * subscribes to `kern.rt.>`; every other service just publishes here.
 *   kern.rt.ch.<channel>  – fan out to all sockets subscribed to that channel
 *   kern.rt.user.<userId> – direct to a user's sockets
 */
export interface Realtime {
  toChannel(ch: string, msg: Omit<ServerMessage, 'seq'> & { seq?: number }): Promise<void>
  toUser(userId: string, msg: Omit<ServerMessage, 'seq'> & { seq?: number }): Promise<void>
  toUsers(userIds: string[], msg: Omit<ServerMessage, 'seq'> & { seq?: number }): Promise<void>
  /** convenience: entity change → workspace channel (+ object channel) */
  change(workspaceId: string, change: EntityChange): Promise<void>
}
export const rtSubject = {
  channel: (ch: string) => `kern.rt.ch.${ch.replace(/:/g, '_')}`,
  user: (u: string) => `kern.rt.user.${u}`,
}

export function createRealtime(
  nats: NatsConnection | undefined,
  local?: (subject: string, msg: unknown) => void,
): Realtime {
  const pub = async (subject: string, msg: unknown) => {
    local?.(subject, msg)
    nats?.publish(subject, sc.encode(JSON.stringify(msg)))
  }
  return {
    toChannel: (ch, msg) => pub(rtSubject.channel(ch), msg),
    toUser: (u, msg) => pub(rtSubject.user(u), msg),
    async toUsers(us, msg) {
      await Promise.all(us.map((u) => pub(rtSubject.user(u), msg)))
    },
    async change(workspaceId, change) {
      const msg = { t: 'change', workspaceId, change } as const
      await pub(rtSubject.channel(channel.workspace(workspaceId)), msg)
      await pub(rtSubject.channel(channel.object(workspaceId, change.module, change.id)), msg)
    },
  }
}
