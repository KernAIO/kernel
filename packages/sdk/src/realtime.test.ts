import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RealtimeClient } from './index.js'

/**
 * A WebSocket the test drives: the sockets a browser opens are indistinguishable from ones the
 * gateway is about to reject, which is the whole point of these suites.
 */
class FakeSocket {
  static instances: FakeSocket[] = []
  readyState = 0
  sent: Array<Record<string, unknown>> = []
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(readonly url: string) {
    FakeSocket.instances.push(this)
  }
  send(raw: string) {
    this.sent.push(JSON.parse(raw))
  }
  close() {
    this.readyState = 3
    this.onclose?.()
  }
  /** the handshake up to the point the server has accepted the socket */
  async accept() {
    this.readyState = 1
    this.onopen?.()
    await Promise.resolve()
  }
  deliver(msg: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(msg) })
  }
  get types() {
    return this.sent.map((m) => m.t)
  }
}

const latest = () => FakeSocket.instances[FakeSocket.instances.length - 1]!

let client: RealtimeClient
const statuses: string[] = []

const makeClient = () =>
  new RealtimeClient({
    url: 'ws://localhost/ws',
    getToken: () => 'session-token',
    WebSocket: FakeSocket as unknown as typeof WebSocket,
    onMessage: () => {},
    onStatus: (s) => statuses.push(s),
  })

beforeEach(() => {
  vi.useFakeTimers()
  FakeSocket.instances = []
  statuses.length = 0
})
afterEach(() => {
  client?.close()
  vi.useRealTimers()
})

describe('RealtimeClient handshake', () => {
  it('sends nothing but hello until the gateway welcomes it', async () => {
    client = makeClient()
    client.subscribe('ws:workspace-1')
    client.connect()
    await latest().accept()

    expect(latest().types).toEqual(['hello'])

    latest().deliver({ t: 'welcome', userId: 'u1', serverTime: 1, resumed: false })
    expect(latest().types).toEqual(['hello', 'sub'])
    expect(latest().sent[1]).toMatchObject({ channels: ['ws:workspace-1'] })
  })

  it('reports open only once the gateway has welcomed it', async () => {
    client = makeClient()
    client.connect()
    await latest().accept()
    expect(statuses).toEqual(['connecting'])

    latest().deliver({ t: 'welcome', userId: 'u1', serverTime: 1, resumed: false })
    expect(statuses).toEqual(['connecting', 'open'])
  })

  it('backs off when the gateway accepts the socket and then rejects the session', async () => {
    client = makeClient()
    client.connect()
    const delays: number[] = []
    let last = 0
    for (let attempt = 0; attempt < 4; attempt++) {
      await latest().accept()
      latest().deliver({ t: 'error', code: 'UNAUTHORIZED', message: 'Invalid or expired session' })
      const before = FakeSocket.instances.length
      latest().close()
      // advance in small steps so the recorded delay is the one the client actually waited
      for (let waited = 0; FakeSocket.instances.length === before && waited < 60_000; waited += 100) {
        await vi.advanceTimersByTimeAsync(100)
        last = waited + 100
      }
      delays.push(last)
    }
    // a rejected client used to retry twice a second forever, because `onopen` reset the backoff
    expect(delays[0]).toBeLessThan(1_000)
    expect(delays[3]).toBeGreaterThan(3_000)
    expect(delays[3]).toBeGreaterThan(delays[0]!)
  })
})
