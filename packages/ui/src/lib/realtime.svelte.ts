import { channel, type ServerMessage } from '@kernhq/contracts'
import { RealtimeClient } from '@kernhq/sdk'
import type { QueryClient } from '@tanstack/svelte-query'
import { keys } from './query.js'

export type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'disabled'

/**
 * Bridges the realtime gateway to the query cache.
 *
 * The server tells us *what* changed (`{module, entity, id}`); query keys are structured the same way,
 * so an event invalidates exactly the queries that depend on it instead of triggering a global refetch.
 * Notifications and badge counts arrive on the same socket and update the inbox and rail immediately.
 */
class Realtime {
  /** `disabled` while no socket is wanted (mock mode), so the UI does not report a false outage */
  status = $state<ConnectionStatus>('disabled')
  /** unread and mention counts per workspace, pushed by the server */
  badges = $state<Record<string, { unread: number; mentions: number }>>({})
  /** users currently online, for presence dots */
  online = $state<Set<string>>(new Set())

  #client: RealtimeClient | null = null
  #queryClient: QueryClient | null = null
  #subscribed = new Set<string>()
  /** modules that want the raw stream (chat keeps its own state rather than a query cache) */
  #taps = new Set<(msg: ServerMessage) => void>()

  /**
   * The shell owns the URL and the token, and passes both.
   *
   * They used to be read here from `$app/environment` and `$env/dynamic/public`, which tied this
   * to one application. A module's screens read presence and badges from this singleton, so it has
   * to live in the framework — and the framework must not know what the app's env vars are called.
   */
  connect(opts: { url: string; queryClient: QueryClient; getToken: () => string | null }) {
    if (this.#client) return
    const { url, queryClient, getToken } = opts
    this.#queryClient = queryClient

    this.#client = new RealtimeClient({
      url,
      getToken,
      onStatus: (s) => {
        this.status = s
        // a reconnect may have missed events, so refresh what the user is looking at
        if (s === 'open') this.#queryClient?.invalidateQueries()
      },
      onMessage: (msg) => this.#handle(msg),
    })
    this.#client.connect()
  }

  /** Follow a workspace (its entity changes) — called when the active workspace changes. */
  watchWorkspace(workspaceId: string) {
    const name = channel.workspace(workspaceId)
    if (this.#subscribed.has(name)) return
    this.#subscribed.add(name)
    this.#client?.subscribe(name)
  }

  /** Follow one object while its detail view is open. */
  watchObject(workspaceId: string, module: string, id: string) {
    const name = channel.object(workspaceId, module, id)
    this.#client?.subscribe(name)
    return () => this.#client?.unsubscribe(name)
  }

  /**
   * Watch the raw message stream.
   *
   * Most of the interface only needs "something changed, refetch it", which is what `#handle` does.
   * Chat is different: it holds the transcript itself, applies messages, typing and presence to it
   * directly, and would tear if it refetched instead. Returns an unsubscribe for `$effect` cleanup.
   */
  tap(fn: (msg: ServerMessage) => void): () => void {
    this.#taps.add(fn)
    return () => this.#taps.delete(fn)
  }

  /** Subscribe to a channel by its raw name (`chat:<id>`), for modules that name their own. */
  subscribeRaw(...channels: string[]) {
    for (const name of channels) this.#subscribed.add(name)
    this.#client?.subscribe(...channels)
  }

  unsubscribeRaw(...channels: string[]) {
    for (const name of channels) this.#subscribed.delete(name)
    this.#client?.unsubscribe(...channels)
  }

  sendTyping(workspaceId: string, channelId: string, threadId?: string) {
    this.#client?.typing(workspaceId, channelId, threadId)
  }

  setPresence(status: 'online' | 'away' | 'dnd' | 'offline') {
    this.#client?.presence(status)
  }

  disconnect() {
    this.#client?.close()
    this.#client = null
    this.#subscribed.clear()
    this.status = 'disabled'
  }

  #handle(msg: ServerMessage) {
    // taps see everything first: a module that owns its own state applies the message itself
    for (const tap of this.#taps) {
      try {
        tap(msg)
      } catch {
        /* one module's failure must not stop the others from seeing the stream */
      }
    }
    const qc = this.#queryClient
    if (!qc) return
    switch (msg.t) {
      case 'change': {
        const { module, entity, id, scope } = msg.change
        // `[module, entity]` is the prefix every key for this entity starts with
        void qc.invalidateQueries({ queryKey: [module, entity] })
        if (scope?.projectId) void qc.invalidateQueries({ queryKey: [module, entity, scope.projectId] })
        if (id) void qc.invalidateQueries({ queryKey: [module, entity, id] })
        break
      }
      case 'notification':
        void qc.invalidateQueries({ queryKey: ['core', 'notification'] })
        void qc.invalidateQueries({ queryKey: keys.notificationCounts() })
        break
      case 'badge': {
        this.badges = {
          ...this.badges,
          [msg.workspaceId]: { unread: msg.unread, mentions: msg.mentions },
        }
        this.#updateAppBadge()
        break
      }
      case 'presence': {
        const next = new Set(this.online)
        if (msg.status === 'offline') next.delete(msg.userId)
        else next.add(msg.userId)
        this.online = next
        break
      }
      default:
        break
    }
  }

  /** Show the total unread count on the installed app icon where the platform supports it. */
  #updateAppBadge() {
    if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return
    const total = Object.values(this.badges).reduce((sum, b) => sum + b.unread, 0)
    const nav = navigator as Navigator & {
      setAppBadge(count?: number): Promise<void>
      clearAppBadge(): Promise<void>
    }
    void (total > 0 ? nav.setAppBadge(total) : nav.clearAppBadge()).catch(() => {})
  }
}

export const realtime = new Realtime()
