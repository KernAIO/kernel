/**
 * The few app-owned things a module's screens legitimately need, handed over by the shell at boot.
 *
 * The rule this package follows is: **stateless things are exported, stateful things are read from
 * a singleton the shell fills.** `session`, `realtime` and this are the second kind. Everything here
 * is something only the application can construct — a configured API client, whether it is running
 * against the in-memory mock — and something a module would otherwise reach into the app for.
 *
 * Deliberately small. This is the seam between the product and the framework, and every field added
 * is a thing a third-party module may depend on for ever. Prefer giving a module a *typed* API of
 * its own over widening this.
 */

export interface Host {
  /** core's API client, configured and authenticated by the shell */
  api: unknown
  /**
   * Origin every module's API client should call.
   *
   * Same-origin in every real deployment — the dev server proxies `/api/<module>` to whichever port
   * hosts it, and the reverse proxy does the same in production — so a module never needs to know
   * that mail listens on 4200. Nine files used to carry their own
   * `env.PUBLIC_API_URL || 'http://localhost:4200'`, which is nine chances for one to be wrong and
   * fail as a connection refused with no clue which module owned it.
   */
  apiBaseUrl: string
  /**
   * WebSocket endpoint of the collab service, for modules with a collaborative editor.
   *
   * Separate from `apiBaseUrl` because it is not the API: it is a socket, on its own path, and an
   * instance may put the collab service somewhere else entirely. Optional — an instance without
   * collaborative editing does not run it, and a module must degrade rather than fail.
   */
  collabUrl?: string
  /** true when the shell is serving the in-memory API (`PUBLIC_API_MOCK=1`) */
  isMock: boolean
  /** stores bytes in mock mode; the real path presigns straight to object storage */
  putMockObject?: (key: string, blob: Blob) => void
}

let host: Host | null = null

/** Called once by the shell, before any module renders. */
export function setHost(next: Host) {
  host = next
}

/**
 * Throws rather than returning null when the shell has not set it.
 *
 * A module reaching for the host before boot is a wiring bug, and a silent null turns it into a
 * `cannot read property of null` three frames away from the cause.
 */
export function getHost(): Host {
  if (!host) throw new Error('@kernhq/ui: the shell has not called setHost() yet')
  return host
}

/** The core API, typed by the caller — a module knows the shape it needs. */
export function coreApi<T>(): T {
  return getHost().api as T
}
