import { HocuspocusProvider, type HocuspocusProviderConfiguration } from '@hocuspocus/provider'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as Y from 'yjs'

/**
 * The client half of collaborative editing.
 *
 * A document is a Y.Doc synchronised through the `collab` service. Everything here is about the
 * three things that decide whether it feels right rather than merely works: who else is in the
 * document, what happens when the network goes, and whose edit an undo actually undoes.
 */

/** What a peer publishes about itself. Anything here is visible to everyone in the document. */
export interface CollabUser {
  id: string
  name: string
  /** the caret colour; stable per user so somebody keeps their colour across a session */
  colour: string
  avatarUrl?: string | null
}

export type CollabStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'readonly'

export interface CollabPeer extends CollabUser {
  /** a peer who may not write shows in the list without a caret */
  readOnly: boolean
}

export interface CollabSession {
  doc: Y.Doc
  provider: HocuspocusProvider
  /** the extensions to hand Tiptap; the editor must not carry its own history plugin as well */
  extensions: unknown[]
  destroy(): void
}

/**
 * Eight colours from the avatar palette, picked by a hash of the user id.
 *
 * Stable rather than random: a caret that changes colour when somebody reloads reads as a second
 * person arriving.
 */
const CARET_COLOURS = [
  'var(--kern-av-0)',
  'var(--kern-av-1)',
  'var(--kern-av-2)',
  'var(--kern-av-3)',
  'var(--kern-av-4)',
  'var(--kern-av-5)',
  'var(--kern-av-6)',
  'var(--kern-av-7)',
]

export function caretColour(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0
  return CARET_COLOURS[Math.abs(hash) % CARET_COLOURS.length] as string
}

export interface CollabOptions {
  /** WebSocket endpoint of the collab service, e.g. `wss://kern.example.com/collab` */
  url: string
  /** `ws:<workspaceId>:<module>:<type>:<id>` — build it with `formatCollabDocument` */
  name: string
  user: CollabUser
  /**
   * A bearer token, for a client that has one. A browser leaves this empty: the session cookie is
   * HttpOnly, so the page cannot read it, and the gateway takes it off the upgrade request instead.
   */
  token?: string
  /** Keep a copy in IndexedDB so the document opens instantly and survives going offline. */
  offline?: boolean
  onStatus?: (status: CollabStatus) => void
  onPeers?: (peers: CollabPeer[]) => void
  onAuthFailed?: (reason: string) => void
}

export function createCollabSession(options: CollabOptions): CollabSession {
  const doc = new Y.Doc()
  let persistence: IndexeddbPersistence | null = null
  if (options.offline !== false && typeof indexedDB !== 'undefined') {
    persistence = new IndexeddbPersistence(options.name, doc)
  }

  let readOnly = false

  const config: HocuspocusProviderConfiguration = {
    url: options.url,
    name: options.name,
    document: doc,
    token: options.token ?? '',
    onAuthenticated: ({ scope }) => {
      readOnly = scope === 'readonly'
      options.onStatus?.(readOnly ? 'readonly' : 'connected')
    },
    onAuthenticationFailed: ({ reason }) => options.onAuthFailed?.(reason),
    onStatus: ({ status }) => {
      if (status === 'connected') options.onStatus?.(readOnly ? 'readonly' : 'connected')
      else if (status === 'connecting') options.onStatus?.('connecting')
      else options.onStatus?.('offline')
    },
    onDisconnect: () => options.onStatus?.('reconnecting'),
  }

  const provider = new HocuspocusProvider(config)

  provider.on('awarenessUpdate', () => {
    const states = provider.awareness?.getStates()
    if (!states) return
    const peers: CollabPeer[] = []
    for (const [clientId, state] of states) {
      if (clientId === doc.clientID) continue
      const u = (state as Record<string, unknown>).user as CollabUser | undefined
      if (!u?.id) continue
      peers.push({ ...u, readOnly: Boolean((state as Record<string, unknown>).readOnly) })
    }
    // One person with two tabs is one person.
    const byId = new Map(peers.map((p) => [p.id, p]))
    options.onPeers?.([...byId.values()])
  })

  const extensions = [
    /**
     * Undo is already scoped to this client, and it is worth knowing why rather than assuming.
     *
     * A bare `Y.UndoManager` tracks origin `null`, so ⌘Z in a shared document undoes whatever
     * happened last — including a paragraph somebody else just wrote. On this path it does not:
     * y-tiptap's undo plugin defaults to `trackedOrigins: new Set([ySyncPluginKey])`, and a remote
     * update arrives with the provider as its origin, so it is never in the undo stack.
     *
     * Do not "fix" this by supplying an `undoManager` of your own without setting `trackedOrigins`
     * — that is exactly how the bug gets introduced.
     */
    Collaboration.configure({
      document: doc,
    }),
    CollaborationCaret.configure({
      provider,
      user: { name: options.user.name, color: options.user.colour, id: options.user.id },
    }),
  ]

  return {
    doc,
    provider,
    extensions,
    destroy() {
      provider.destroy()
      persistence?.destroy()
      doc.destroy()
    },
  }
}
