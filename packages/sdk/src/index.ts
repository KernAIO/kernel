import { type ClientMessage, type CoreContract, coreContract, type ServerMessage } from '@kernalo/contracts'
import { createORPCClient, onError } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { ContractRouterClient } from '@orpc/contract'

export type CoreClient = ContractRouterClient<CoreContract>
export interface KernClientOptions {
  /** e.g. https://kern.example.com (Caddy) or http://localhost:4000 */
  baseUrl: string
  /** returns the session/bearer token (or null for cookie auth) */
  getToken?: () => Promise<string | null> | string | null
  fetch?: typeof fetch
  headers?: Record<string, string>
  onUnauthorized?: () => void
}

/** oRPC link to a module's RPC endpoint: <baseUrl>/api/<module>/rpc */
export function createModuleLink(opts: KernClientOptions, module: string) {
  return new RPCLink({
    url: `${opts.baseUrl.replace(/\/$/, '')}/api/${module}/rpc`,
    fetch: opts.fetch ?? ((input, init) => globalThis.fetch(input, { ...init, credentials: 'include' })),
    headers: async () => {
      const token = await opts.getToken?.()
      return { ...(opts.headers ?? {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }
    },
    interceptors: [
      onError((e: any) => {
        if (e?.code === 'UNAUTHORIZED') opts.onUnauthorized?.()
      }),
    ],
  })
}
/** Typed client for any module given its contract type. */
export function createModuleClient<T>(opts: KernClientOptions, module: string): T {
  return createORPCClient(createModuleLink(opts, module)) as T
}
export function createCoreClient(opts: KernClientOptions): CoreClient {
  return createModuleClient<CoreClient>(opts, 'core')
}
export { coreContract }

// ---------------- realtime ----------------
export interface RealtimeOptions {
  url: string // wss://host/ws
  getToken: () => Promise<string | null> | string | null
  clientId?: string
  onMessage: (msg: ServerMessage) => void
  onStatus?: (s: 'connecting' | 'open' | 'closed') => void
  WebSocket?: typeof WebSocket
}
/** Reconnecting WebSocket client speaking the Kern realtime protocol (see @kernalo/contracts/realtime). */
export class RealtimeClient {
  private ws: WebSocket | null = null
  private subs = new Set<string>()
  private seq = 0
  private retry = 0
  private closed = false
  private pingTimer: ReturnType<typeof setInterval> | null = null
  constructor(private readonly opts: RealtimeOptions) {}

  connect() {
    this.closed = false
    this.open()
  }
  private async open() {
    this.opts.onStatus?.('connecting')
    const WS = this.opts.WebSocket ?? globalThis.WebSocket
    const ws = new WS(this.opts.url)
    this.ws = ws
    ws.onopen = async () => {
      this.retry = 0
      const token = (await this.opts.getToken()) ?? ''
      this.send({
        t: 'hello',
        token,
        clientId: this.opts.clientId ?? cryptoId(),
        since: this.seq || undefined,
      })
      if (this.subs.size) this.send({ t: 'sub', channels: [...this.subs] })
      this.opts.onStatus?.('open')
      this.pingTimer = setInterval(() => this.send({ t: 'ping' }), 25_000)
    }
    ws.onmessage = (ev) => {
      let msg: ServerMessage
      try {
        msg = JSON.parse(String(ev.data))
      } catch {
        return
      }
      if ('seq' in msg && typeof msg.seq === 'number') this.seq = msg.seq
      this.opts.onMessage(msg)
    }
    ws.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer)
      this.opts.onStatus?.('closed')
      if (this.closed) return
      const delay = Math.min(30_000, 500 * 2 ** this.retry++) + Math.random() * 300
      setTimeout(() => this.open(), delay)
    }
    ws.onerror = () => ws.close()
  }
  send(msg: ClientMessage) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg))
  }
  subscribe(...channels: string[]) {
    for (const c of channels) this.subs.add(c)
    this.send({ t: 'sub', channels })
  }
  unsubscribe(...channels: string[]) {
    for (const c of channels) this.subs.delete(c)
    this.send({ t: 'unsub', channels })
  }
  typing(workspaceId: string, channelId: string, threadId?: string) {
    this.send({
      t: 'typing',
      workspaceId: workspaceId as any,
      channelId: channelId as any,
      threadId: threadId as any,
    })
  }
  presence(status: 'online' | 'away' | 'dnd' | 'offline') {
    this.send({ t: 'presence', status })
  }
  close() {
    this.closed = true
    this.ws?.close()
  }
}
const cryptoId = () =>
  globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2)
