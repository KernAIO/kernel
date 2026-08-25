/**
 * Recording a voice or video message.
 *
 * Wraps `MediaRecorder` in something a component can bind to: ask, record, stop, keep or discard.
 * Three things this has to get right, because each one is a way to lose somebody's recording or
 * their trust:
 *
 * - **The microphone light goes out when you stop.** Every track is stopped explicitly; leaving a
 *   stream open keeps the browser's recording indicator on and the camera warm.
 * - **Nothing is sent until you say so.** Stopping gives you a preview to listen to; discarding
 *   throws the blob away and releases its object URL.
 * - **A refused permission is a sentence, not a stack trace.** The browser's own error names are
 *   translated into something a person can act on.
 */

export type RecorderKind = 'audio' | 'video'
export type RecorderState = 'idle' | 'asking' | 'recording' | 'paused' | 'review' | 'denied'

/** What a browser will actually record, best first. Safari and Chrome disagree about containers. */
const CANDIDATES: Record<RecorderKind, string[]> = {
  audio: ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'],
  video: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'],
}

function pickMimeType(kind: RecorderKind): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return CANDIDATES[kind].find((type) => MediaRecorder.isTypeSupported(type))
}

/** `audio/webm;codecs=opus` → `webm`, for the file name. */
function extensionFor(mimeType: string): string {
  const base = mimeType.split(';')[0] ?? ''
  const subtype = base.split('/')[1] ?? 'bin'
  return subtype === 'mpeg' ? 'mp3' : subtype
}

export interface Recording {
  blob: Blob
  mimeType: string
  /** how long it runs, in milliseconds */
  durationMs: number
  /** an object URL for previewing it; released by `discard()` */
  url: string
  suggestedName: string
}

export class MediaRecording {
  state = $state<RecorderState>('idle')
  /** milliseconds recorded so far, updated about ten times a second */
  elapsedMs = $state(0)
  error = $state<string | null>(null)
  result = $state<Recording | null>(null)
  /** the live stream, so a video recorder can show a preview while it records */
  stream = $state<MediaStream | null>(null)

  #recorder: MediaRecorder | null = null
  #chunks: Blob[] = []
  #startedAt = 0
  #ticker: ReturnType<typeof setInterval> | null = null
  #kind: RecorderKind = 'audio'

  get supported(): boolean {
    return (
      typeof MediaRecorder !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia
    )
  }

  async start(kind: RecorderKind): Promise<void> {
    if (!this.supported) {
      this.state = 'denied'
      this.error = 'unsupported'
      return
    }
    this.#kind = kind
    this.state = 'asking'
    this.error = null

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia(
        kind === 'video'
          ? { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 } } }
          : { audio: true },
      )
    } catch (error) {
      this.state = 'denied'
      this.error = describe(error)
      return
    }

    const mimeType = pickMimeType(kind)
    this.stream = stream
    this.#chunks = []
    this.#recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    this.#recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.#chunks.push(event.data)
    }
    this.#recorder.onstop = () => this.#finish(mimeType ?? this.#recorder?.mimeType ?? '')
    this.#recorder.start(250)

    this.#startedAt = Date.now()
    this.elapsedMs = 0
    this.state = 'recording'
    this.#ticker = setInterval(() => {
      this.elapsedMs = Date.now() - this.#startedAt
    }, 100)
  }

  /** Stop recording and keep what was recorded, for review. */
  stop(): void {
    if (this.#recorder && this.#recorder.state !== 'inactive') this.#recorder.stop()
    this.#releaseStream()
    if (this.#ticker) {
      clearInterval(this.#ticker)
      this.#ticker = null
    }
  }

  /** Stop and throw the recording away, releasing the camera, the microphone and the object URL. */
  discard(): void {
    if (this.#recorder && this.#recorder.state !== 'inactive') {
      this.#recorder.onstop = null
      this.#recorder.stop()
    }
    this.#releaseStream()
    if (this.#ticker) {
      clearInterval(this.#ticker)
      this.#ticker = null
    }
    if (this.result) URL.revokeObjectURL(this.result.url)
    this.result = null
    this.#chunks = []
    this.elapsedMs = 0
    this.state = 'idle'
    this.error = null
  }

  #finish(mimeType: string) {
    const type = mimeType || (this.#kind === 'video' ? 'video/webm' : 'audio/webm')
    const blob = new Blob(this.#chunks, { type })
    const durationMs = Date.now() - this.#startedAt
    const extension = extensionFor(type)
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    this.result = {
      blob,
      mimeType: type,
      durationMs,
      url: URL.createObjectURL(blob),
      suggestedName: `${this.#kind === 'video' ? 'video' : 'voice'}-${stamp}.${extension}`,
    }
    this.state = 'review'
  }

  #releaseStream() {
    // without this the browser keeps showing "recording" and the camera light stays on
    for (const track of this.stream?.getTracks() ?? []) track.stop()
    this.stream = null
  }
}

/** Turn a `getUserMedia` rejection into something worth showing somebody. */
function describe(error: unknown): string {
  const name = error instanceof Error ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'no-device'
    case 'NotReadableError':
      return 'in-use'
    default:
      return 'failed'
  }
}

/** `93000` → `1:33`. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
