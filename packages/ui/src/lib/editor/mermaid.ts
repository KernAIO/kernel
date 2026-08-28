/**
 * Mermaid, drawn without a browser.
 *
 * A diagram in a wiki page has to appear in places that have no DOM: a published site, a PDF, an
 * exported HTML file, a mail digest. Mermaid's own library cannot go there — it measures text with
 * `getBBox`, so it needs a real layout engine, which is why every "server-side Mermaid" in the wild
 * is a headless Chromium. A wiki page is not worth a browser per render, and a browser per render is
 * not something a self-hosted instance should have to run. So this file draws the two notations
 * people actually put in a wiki — a flowchart and a sequence diagram — from the source text, with no
 * imports, no DOM and no network, and hands back an SVG string.
 *
 * **It is strict on purpose.** Anything it cannot draw *faithfully* — a subgraph, an `alt` block, a
 * shape it has no polygon for — is a failure with a reason, not a diagram with a piece missing.
 * Silently dropping a `loop` box changes what a sequence diagram says, and a reader has no way to
 * know it happened; falling back to the source with a sentence explaining why is honest, and the
 * writer can see immediately that this diagram needs a picture rather than a notation. `renderPageDoc`
 * in @kernhq/module-quire is what turns a failure into that fallback, and the editor's own node view
 * calls this same function, so a writer sees exactly what a reader will.
 *
 * This file imports nothing, for the same reason `page-doc.ts` imports nothing: it is loaded by a
 * Node process that has no Svelte toolchain and no reason to pull ProseMirror in.
 *
 * Two properties the tests hold it to, both of which matter more than the drawing being pretty:
 *
 *   - **Every character that comes from the source is escaped.** The output is written into a page
 *     unescaped — it has to be, it is markup — so a label reading `</svg><script>` must not be able
 *     to end the picture. There is no path here by which source text reaches the output unescaped.
 *   - **The picture is theme-agnostic.** Strokes and text are `currentColor` and the grounds are
 *     left to CSS, so one SVG reads correctly on paper, in dark mode and in a printout, rather than
 *     being black-on-white everywhere and invisible in half of them.
 */

/* ---------------------------------------------------------------------------------------------- */
/* The answer                                                                                       */
/* ---------------------------------------------------------------------------------------------- */

/**
 * Why a source did not become a picture.
 *
 * Three, and the split is the one a reader cares about rather than the one a parser would make:
 * `empty` is nothing to draw, `unsupported` is "this is valid Mermaid and this renderer does not do
 * it", and `syntax` is "this is not Mermaid". They are reasons rather than sentences because the
 * sentence has to be in the reader's language, and this file has no message runtime — the caller
 * that knows who is reading supplies the words, exactly as `MacroStrings` already does.
 */
export const MERMAID_FAILURES = ['empty', 'unsupported', 'syntax'] as const
export type MermaidFailureReason = (typeof MERMAID_FAILURES)[number]

export interface MermaidFailure {
  ok: false
  reason: MermaidFailureReason
  /** 1-based, when the failure belongs to one line of the source. */
  line: number | null
}

export interface MermaidSuccess {
  ok: true
  /** A complete `<svg>` element. Safe to write into a page: every source character in it is escaped. */
  svg: string
  width: number
  height: number
}

export type MermaidRender = MermaidSuccess | MermaidFailure

/** What this renderer draws. Anything else is `unsupported` rather than approximated. */
export const MERMAID_DIAGRAMS = ['flowchart', 'sequence'] as const
export type MermaidDiagram = (typeof MERMAID_DIAGRAMS)[number]

/* ---------------------------------------------------------------------------------------------- */
/* Limits                                                                                           */
/* ---------------------------------------------------------------------------------------------- */

/**
 * How much a diagram may be.
 *
 * A document decides how much work a render does, and a page render happens on every public read —
 * so these are ceilings rather than guidance. A source over one of them fails as `unsupported`,
 * which draws the source: the writer sees their diagram is too big for the page, rather than the
 * server spending a second on it.
 */
const MAX_LINES = 400
const MAX_NODES = 120
const MAX_EDGES = 240
const MAX_MESSAGES = 120
const MAX_PARTICIPANTS = 20

/* ---------------------------------------------------------------------------------------------- */
/* Type and geometry                                                                                */
/* ---------------------------------------------------------------------------------------------- */

const FONT_SIZE = 13
const LINE_HEIGHT = 17
/** An estimate, because there is nothing here to measure with. 13px sans averages a shade under 7. */
const CHAR_WIDTH = 6.9
const PAD_X = 14
const PAD_Y = 11
const MIN_NODE_WIDTH = 56
const WRAP_CHARS = 22
const MAX_LABEL_LINES = 3
const GAP_MAIN = 56
const GAP_CROSS = 28
const MARGIN = 12

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
/** Both quote characters, so an escaped value is safe in an attribute however it is quoted. */
const esc = (value: string): string => value.replace(/[&<>"']/g, (c) => ESCAPES[c] as string)

/** Rounded to one place: a viewBox full of seventeen-digit floats is unreadable and pointlessly big. */
const n = (value: number): string => (Math.round(value * 10) / 10).toString()

/**
 * A short, stable name for this source, so two diagrams on one page do not share a marker.
 *
 * An SVG `<marker>` is referenced by id and ids are document-global, so two diagrams both defining
 * `#arrow` means the second one silently redefines the first — the arrowheads of one page's diagram
 * drawn with another's stroke width. djb2 because it needs to be stable and short, not secure.
 */
function sourceKey(source: string): string {
  let hash = 5381
  for (let i = 0; i < source.length; i++) hash = ((hash << 5) + hash + source.charCodeAt(i)) | 0
  return (hash >>> 0).toString(36)
}

/** Break a label the way a box would: explicit breaks first, then greedily on words. */
function wrap(label: string): string[] {
  const out: string[] = []
  for (const chunk of label.split(/<br\s*\/?>|\\n|\n/)) {
    const words = chunk.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      if (chunk.trim() === '') out.push('')
      continue
    }
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (candidate.length > WRAP_CHARS && line) {
        out.push(line)
        line = word
      } else line = candidate
    }
    if (line) out.push(line)
  }
  const lines = out.filter((line, index) => line !== '' || index === 0)
  if (lines.length <= MAX_LABEL_LINES) return lines.length > 0 ? lines : ['']
  // The overflow is marked rather than dropped: a truncated label that says nothing about being
  // truncated is a diagram that reads as complete and is not.
  return [...lines.slice(0, MAX_LABEL_LINES - 1), `${lines[MAX_LABEL_LINES - 1]?.slice(0, WRAP_CHARS)}…`]
}

const textWidth = (lines: string[]): number => Math.max(...lines.map((line) => line.length)) * CHAR_WIDTH

/** `<text>` with one `<tspan>` per line, centred on `(x, y)`. Every line is escaped. */
function textBlock(lines: string[], x: number, y: number, extra = ''): string {
  const top = y - ((lines.length - 1) * LINE_HEIGHT) / 2
  const spans = lines
    .map((line, index) => `<tspan x="${n(x)}" y="${n(top + index * LINE_HEIGHT)}">${esc(line)}</tspan>`)
    .join('')
  return `<text text-anchor="middle" dominant-baseline="central" font-size="${FONT_SIZE}" fill="currentColor"${extra}>${spans}</text>`
}

/* ---------------------------------------------------------------------------------------------- */
/* Reading the source                                                                               */
/* ---------------------------------------------------------------------------------------------- */

interface SourceLine {
  text: string
  /** 1-based, in the source the writer typed — so an error names the line they can see. */
  number: number
}

/**
 * The source as statements, with comments and directives gone.
 *
 * `%%{init: …}%%` is a directive to Mermaid's own renderer about themes and layout; this renderer
 * has neither, so it is dropped rather than refused — a diagram that draws correctly should not fail
 * because somebody asked for a colour scheme we do not have. A `%%` comment goes the same way.
 */
function statements(source: string): SourceLine[] {
  const out: SourceLine[] = []
  const lines = source.replace(/%%\{[\s\S]*?\}%%/g, '').split('\n')
  for (let i = 0; i < lines.length && out.length < MAX_LINES; i++) {
    const raw = (lines[i] ?? '').replace(/%%.*$/, '')
    for (const part of raw.split(';')) {
      const text = part.trim()
      if (text) out.push({ text, number: i + 1 })
    }
  }
  return out
}

const failure = (reason: MermaidFailureReason, line: number | null = null): MermaidFailure => ({
  ok: false,
  reason,
  line,
})

/**
 * Draw a Mermaid source, or say why not.
 *
 * The one entry point, and deliberately synchronous and pure: it is called from a page render that
 * is already a pure function of a document, and from a node view in the editor that has to draw on
 * every keystroke.
 */
export function renderMermaid(source: string): MermaidRender {
  if (typeof source !== 'string') return failure('empty')
  const lines = statements(source)
  if (lines.length === 0) return failure('empty')

  const header = lines[0] as SourceLine
  const key = sourceKey(source)

  const flow = /^(?:flowchart|graph)\b\s*(TB|TD|BT|RL|LR)?\s*$/i.exec(header.text)
  if (flow) return flowchart(lines.slice(1), (flow[1] ?? 'TD').toUpperCase(), key)

  if (/^sequenceDiagram\b\s*$/i.test(header.text)) return sequence(lines.slice(1), key)

  return failure('unsupported', header.number)
}

/* ---------------------------------------------------------------------------------------------- */
/* Flowcharts                                                                                       */
/* ---------------------------------------------------------------------------------------------- */

type Shape = 'rect' | 'round' | 'stadium' | 'circle' | 'diamond' | 'hexagon'

interface FlowNode {
  id: string
  lines: string[]
  shape: Shape
  width: number
  height: number
  x: number
  y: number
  rank: number
}

interface FlowEdge {
  from: string
  to: string
  label: string[]
  style: 'solid' | 'dotted' | 'thick'
  arrow: boolean
}

/**
 * The shapes this renderer has a polygon for.
 *
 * Written as a table rather than a chain of `if`s because the *closed*ness is the point: a shape not
 * in it is `unsupported`, which draws the source. A cylinder approximated as a rectangle is a
 * database drawn as a box, and nothing in the output would say so.
 */
const SHAPES: Array<{ open: string; close: string; shape: Shape }> = [
  { open: '((', close: '))', shape: 'circle' },
  { open: '([', close: '])', shape: 'stadium' },
  { open: '{{', close: '}}', shape: 'hexagon' },
  { open: '[', close: ']', shape: 'rect' },
  { open: '(', close: ')', shape: 'round' },
  { open: '{', close: '}', shape: 'diamond' },
]

/**
 * Delimiters that open a shape this renderer does not draw, checked before the ones it does.
 *
 * `A[(Postgres)]` is a cylinder and its body both starts with `[` and ends with `]`, so the plain
 * rectangle rule matches it — and a database silently drawn as a box is exactly the kind of quietly
 * wrong picture this renderer refuses to produce. Longest first, because `(((` opens with `((`.
 */
const UNSUPPORTED_SHAPES = ['(((', '[[', '[(', '[/', '[\\', '(-', '>', '{{{']

const ID_RE = /^[A-Za-z0-9_.-]+$/
/** Longest first, so `-->` is never read as `--` followed by a node called `>`. */
const EDGE_RE = /(-\.-*->|-\.-+|-+->|-+-|=+=>|=+=)/

/** `A -- yes --> B` is `A -->|yes| B` written the other way round; one shape reaches the parser. */
function foldEdgeLabels(text: string): string {
  return text
    .replace(/--\s+([^->|][^|]*?)\s+(-+->|-+-)/g, (_m, label: string, op: string) => `${op}|${label}|`)
    .replace(/-\.\s+([^|]*?)\s+\.-(>?)/g, (_m, label: string, head: string) => `-.-${head}|${label}|`)
    .replace(/==\s+([^=|][^|]*?)\s+(=+=>|=+=)/g, (_m, label: string, op: string) => `${op}|${label}|`)
}

/** One `id`, `id[Label]`, `id{Label}` … or nothing this renderer knows how to draw. */
function parseNodeRef(raw: string): { id: string; lines: string[] | null; shape: Shape } | null {
  const text = raw.trim()
  if (!text) return null
  const bracket = text.search(/[[({]/)
  if (bracket === -1) return ID_RE.test(text) ? { id: text, lines: null, shape: 'rect' } : null

  const id = text.slice(0, bracket).trim()
  if (!ID_RE.test(id)) return null
  const body = text.slice(bracket)
  if (UNSUPPORTED_SHAPES.some((open) => body.startsWith(open))) return null
  for (const { open, close, shape } of SHAPES) {
    if (!body.startsWith(open) || !body.endsWith(close)) continue
    const inner = body.slice(open.length, body.length - close.length).trim()
    const unquoted = /^"(.*)"$/s.exec(inner)?.[1] ?? inner
    return { id, lines: wrap(unquoted || id), shape }
  }
  return null
}

function edgeStyle(op: string): { style: FlowEdge['style']; arrow: boolean } {
  if (op.startsWith('-.')) return { style: 'dotted', arrow: op.endsWith('>') }
  if (op.startsWith('=')) return { style: 'thick', arrow: op.endsWith('>') }
  return { style: 'solid', arrow: op.endsWith('>') }
}

function flowchart(lines: SourceLine[], direction: string, key: string): MermaidRender {
  const nodes = new Map<string, FlowNode>()
  const edges: FlowEdge[] = []

  const touch = (ref: { id: string; lines: string[] | null; shape: Shape }): FlowNode => {
    const existing = nodes.get(ref.id)
    if (existing) {
      // A later mention that carries a label wins: `A --> B` then `B[Done]` is how people write.
      if (ref.lines) {
        existing.lines = ref.lines
        existing.shape = ref.shape
      }
      return existing
    }
    const node: FlowNode = {
      id: ref.id,
      lines: ref.lines ?? wrap(ref.id),
      shape: ref.shape,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      rank: 0,
    }
    nodes.set(ref.id, node)
    return node
  }

  for (const line of lines) {
    const text = line.text
    if (/^(?:classDef|class|style|linkStyle|click|direction|accTitle|accDescr)\b/i.test(text)) continue
    /*
     * A subgraph is a box the writer drew round a group, and this renderer has no box. Keeping the
     * nodes and dropping the grouping would produce a diagram that is not the one on the screen, so
     * it fails and the source is shown instead.
     */
    if (/^(?:subgraph|end)\b/i.test(text)) return failure('unsupported', line.number)

    const folded = foldEdgeLabels(text)
    const parts = folded.split(EDGE_RE)
    if (parts.length === 1) {
      // A statement with no edge in it is a bare node declaration, and nothing else is legal here.
      const ref = parseNodeRef(parts[0] ?? '')
      if (!ref) return failure('syntax', line.number)
      touch(ref)
      continue
    }

    let previous: FlowNode | null = null
    for (let i = 0; i < parts.length; i += 2) {
      let segment = parts[i] ?? ''
      let label: string[] = []
      // A `|label|` at the head of a segment belongs to the operator in front of it.
      const piped = /^\s*\|([^|]*)\|\s*/.exec(segment)
      if (piped) {
        label = wrap(piped[1] ?? '')
        segment = segment.slice(piped[0].length)
      }
      const ref = parseNodeRef(segment)
      if (!ref) return failure('syntax', line.number)
      const node = touch(ref)
      const op = parts[i - 1]
      if (previous && op) {
        const { style, arrow } = edgeStyle(op)
        edges.push({ from: previous.id, to: node.id, label, style, arrow })
      }
      previous = node
    }
    if (nodes.size > MAX_NODES || edges.length > MAX_EDGES) return failure('unsupported', line.number)
  }

  if (nodes.size === 0) return failure('empty')

  for (const node of nodes.values()) {
    const width = Math.max(MIN_NODE_WIDTH, textWidth(node.lines) + PAD_X * 2)
    const height = node.lines.length * LINE_HEIGHT + PAD_Y * 2
    // A diamond has to hold its label in half its area, so it is grown rather than overflowed.
    node.width = node.shape === 'diamond' ? width * 1.35 : width
    node.height = node.shape === 'diamond' ? height * 1.5 : height
    if (node.shape === 'circle') {
      const side = Math.max(node.width, node.height)
      node.width = side
      node.height = side
    }
  }

  rank(nodes, edges)
  const horizontal = direction === 'LR' || direction === 'RL'
  const { width, height } = place(nodes, horizontal)

  const flipMain = direction === 'BT' || direction === 'RL'
  if (flipMain)
    for (const node of nodes.values()) {
      if (horizontal) node.x = width - node.x
      else node.y = height - node.y
    }

  const body = [
    ...edges.map((edge) => drawEdge(edge, nodes, key)),
    ...[...nodes.values()].map(drawNode),
  ].join('')
  return svg(width, height, key, body)
}

/**
 * Longest-path ranking, bounded rather than cycle-checked.
 *
 * A flowchart with a cycle in it is perfectly ordinary — a retry loop is a cycle — so refusing one
 * would refuse a diagram people write every day. Relaxing every edge at most `nodes` times gives a
 * DAG its exact longest-path ranking and gives a cyclic graph *a* ranking, bounded by the number of
 * nodes, which lays out as a readable spiral rather than not at all.
 */
function rank(nodes: Map<string, FlowNode>, edges: FlowEdge[]): void {
  for (let round = 0; round < nodes.size; round++) {
    let changed = false
    for (const edge of edges) {
      const from = nodes.get(edge.from)
      const to = nodes.get(edge.to)
      if (!from || !to || to === from) continue
      if (to.rank < from.rank + 1) {
        to.rank = from.rank + 1
        changed = true
      }
    }
    if (!changed) break
  }
}

/** Ranks become rows (or columns), each centred against the widest one. */
function place(nodes: Map<string, FlowNode>, horizontal: boolean): { width: number; height: number } {
  const ranks = new Map<number, FlowNode[]>()
  for (const node of nodes.values()) {
    const bucket = ranks.get(node.rank)
    if (bucket) bucket.push(node)
    else ranks.set(node.rank, [node])
  }
  const ordered = [...ranks.keys()].sort((a, b) => a - b)

  /** Along the flow: the depth of each rank. Across it: how wide the rank's row is. */
  const main = (node: FlowNode) => (horizontal ? node.width : node.height)
  const cross = (node: FlowNode) => (horizontal ? node.height : node.width)

  let mainOffset = MARGIN
  let crossExtent = 0
  const rows: Array<{ nodes: FlowNode[]; depth: number; extent: number; offset: number }> = []
  for (const index of ordered) {
    const bucket = ranks.get(index) as FlowNode[]
    const depth = Math.max(...bucket.map(main))
    const extent = bucket.reduce((sum, node) => sum + cross(node), 0) + GAP_CROSS * (bucket.length - 1)
    rows.push({ nodes: bucket, depth, extent, offset: mainOffset })
    mainOffset += depth + GAP_MAIN
    crossExtent = Math.max(crossExtent, extent)
  }

  for (const row of rows) {
    let at = MARGIN + (crossExtent - row.extent) / 2
    for (const node of row.nodes) {
      const centreMain = row.offset + row.depth / 2
      const centreCross = at + cross(node) / 2
      node.x = horizontal ? centreMain : centreCross
      node.y = horizontal ? centreCross : centreMain
      at += cross(node) + GAP_CROSS
    }
  }

  const mainTotal = mainOffset - GAP_MAIN + MARGIN
  const crossTotal = crossExtent + MARGIN * 2
  return horizontal ? { width: mainTotal, height: crossTotal } : { width: crossTotal, height: mainTotal }
}

function drawNode(node: FlowNode): string {
  const { x, y, width: w, height: h } = node
  const left = x - w / 2
  const top = y - h / 2
  const outline = ' class="kern-mermaid-shape" stroke="currentColor" stroke-width="1.5"'
  let shape: string
  switch (node.shape) {
    case 'circle':
      shape = `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(w / 2)}" ry="${n(h / 2)}"${outline}/>`
      break
    case 'diamond':
      shape = `<polygon points="${n(x)},${n(top)} ${n(left + w)},${n(y)} ${n(x)},${n(top + h)} ${n(left)},${n(y)}"${outline}/>`
      break
    case 'hexagon': {
      const notch = Math.min(16, w / 4)
      shape = `<polygon points="${n(left + notch)},${n(top)} ${n(left + w - notch)},${n(top)} ${n(left + w)},${n(y)} ${n(left + w - notch)},${n(top + h)} ${n(left + notch)},${n(top + h)} ${n(left)},${n(y)}"${outline}/>`
      break
    }
    default: {
      const radius = node.shape === 'stadium' ? h / 2 : node.shape === 'round' ? 14 : 5
      shape = `<rect x="${n(left)}" y="${n(top)}" width="${n(w)}" height="${n(h)}" rx="${n(radius)}"${outline}/>`
    }
  }
  return `<g>${shape}${textBlock(node.lines, x, y)}</g>`
}

/**
 * Where a straight line from one box's centre to another's leaves the first box.
 *
 * Drawn between borders rather than centres so an arrowhead lands on the edge of the shape instead
 * of under it. A diamond and an ellipse are clipped as their bounding box, which is a couple of
 * pixels out on the diagonal and invisible at this scale.
 */
function borderPoint(node: FlowNode, towardsX: number, towardsY: number): { x: number; y: number } {
  const dx = towardsX - node.x
  const dy = towardsY - node.y
  if (dx === 0 && dy === 0) return { x: node.x, y: node.y }
  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : node.width / 2 / Math.abs(dx)
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : node.height / 2 / Math.abs(dy)
  const scale = Math.min(scaleX, scaleY)
  return { x: node.x + dx * scale, y: node.y + dy * scale }
}

function drawEdge(edge: FlowEdge, nodes: Map<string, FlowNode>, key: string): string {
  const from = nodes.get(edge.from)
  const to = nodes.get(edge.to)
  if (!from || !to) return ''
  const start = borderPoint(from, to.x, to.y)
  const end = borderPoint(to, from.x, from.y)
  const dash = edge.style === 'dotted' ? ' stroke-dasharray="5 4"' : ''
  const weight = edge.style === 'thick' ? 3 : 1.5
  const head = edge.arrow ? ` marker-end="url(#kern-arrow-${key})"` : ''
  const line = `<line x1="${n(start.x)}" y1="${n(start.y)}" x2="${n(end.x)}" y2="${n(end.y)}" stroke="currentColor" stroke-width="${weight}"${dash}${head}/>`
  if (edge.label.length === 0) return line

  const midX = (start.x + end.x) / 2
  const midY = (start.y + end.y) / 2
  const boxW = textWidth(edge.label) + 10
  const boxH = edge.label.length * LINE_HEIGHT + 4
  /*
   * A ground behind the label, with no fill of its own: `.kern-mermaid-ground` is filled by the
   * page's paper colour in prose.css and by a flat one in an exported file. Left unstyled it is
   * transparent, which is the same picture with the line showing through the words — worse, and not
   * broken.
   */
  const ground = `<rect class="kern-mermaid-ground" x="${n(midX - boxW / 2)}" y="${n(midY - boxH / 2)}" width="${n(boxW)}" height="${n(boxH)}" rx="3"/>`
  return `${line}${ground}${textBlock(edge.label, midX, midY)}`
}

/* ---------------------------------------------------------------------------------------------- */
/* Sequence diagrams                                                                                */
/* ---------------------------------------------------------------------------------------------- */

interface Participant {
  id: string
  lines: string[]
  x: number
  width: number
}

type SequenceStep =
  | { kind: 'message'; from: string; to: string; label: string[]; dashed: boolean; open: boolean }
  | { kind: 'note'; over: string[]; label: string[] }

const SEQ_MESSAGE = /^(\S+)\s*(--?>>?)\s*(\S+?)\s*:\s*(.*)$/
const SEQ_PARTICIPANT = /^(?:participant|actor)\s+(\S+)(?:\s+as\s+(.+))?$/i
const SEQ_NOTE = /^note\s+over\s+([^:]+):\s*(.*)$/i

const PARTICIPANT_TOP = 12
const PARTICIPANT_HEIGHT = 34
const STEP_HEIGHT = 40
const NOTE_HEIGHT = 34

function sequence(lines: SourceLine[], key: string): MermaidRender {
  const participants = new Map<string, Participant>()
  const steps: SequenceStep[] = []

  const touch = (id: string, label?: string): Participant => {
    const existing = participants.get(id)
    if (existing) {
      if (label) existing.lines = wrap(label)
      return existing
    }
    const p: Participant = { id, lines: wrap(label ?? id), x: 0, width: 0 }
    participants.set(id, p)
    return p
  }

  for (const line of lines) {
    const text = line.text
    if (/^(?:autonumber|accTitle|accDescr)\b/i.test(text)) continue

    const declared = SEQ_PARTICIPANT.exec(text)
    if (declared) {
      if (!ID_RE.test(declared[1] as string)) return failure('syntax', line.number)
      touch(declared[1] as string, declared[2]?.trim())
      continue
    }

    const note = SEQ_NOTE.exec(text)
    if (note) {
      const over = (note[1] as string)
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
      if (over.length === 0 || over.some((name) => !ID_RE.test(name))) return failure('syntax', line.number)
      for (const name of over) touch(name)
      steps.push({ kind: 'note', over, label: wrap(note[2] as string) })
      continue
    }

    const message = SEQ_MESSAGE.exec(text)
    if (message) {
      const [, from, arrow, to, label] = message as unknown as [string, string, string, string, string]
      if (!ID_RE.test(from) || !ID_RE.test(to)) return failure('syntax', line.number)
      touch(from)
      touch(to)
      steps.push({
        kind: 'message',
        from,
        to,
        label: wrap(label),
        dashed: arrow.startsWith('--'),
        open: !arrow.endsWith('>>'),
      })
      if (steps.length > MAX_MESSAGES) return failure('unsupported', line.number)
      continue
    }

    /*
     * `loop`, `alt`, `opt`, `par`, `activate` and the rest are frames and bars this renderer does not
     * draw, and a sequence diagram missing its `alt` box says something different from the one that
     * was written. So an unknown statement fails the whole diagram rather than being skipped.
     */
    return failure('unsupported', line.number)
  }

  if (participants.size === 0) return failure('empty')
  if (participants.size > MAX_PARTICIPANTS) return failure('unsupported')

  let x = MARGIN
  for (const p of participants.values()) {
    p.width = Math.max(MIN_NODE_WIDTH + 20, textWidth(p.lines) + PAD_X * 2)
    p.x = x + p.width / 2
    x += p.width + GAP_CROSS * 2
  }
  const width = x - GAP_CROSS * 2 + MARGIN
  const first = PARTICIPANT_TOP + PARTICIPANT_HEIGHT + 28
  let y = first
  const body: string[] = []

  for (const step of steps) {
    if (step.kind === 'note') {
      const named = step.over.map((id) => participants.get(id)).filter((p): p is Participant => Boolean(p))
      if (named.length === 0) continue
      const left = Math.min(...named.map((p) => p.x - p.width / 2))
      const right = Math.max(...named.map((p) => p.x + p.width / 2))
      const height = Math.max(NOTE_HEIGHT, step.label.length * LINE_HEIGHT + 12)
      body.push(
        `<g><rect class="kern-mermaid-note" x="${n(left)}" y="${n(y)}" width="${n(right - left)}" height="${n(height)}" rx="4" stroke="currentColor" stroke-width="1.5"/>${textBlock(step.label, (left + right) / 2, y + height / 2)}</g>`,
      )
      y += height + 16
      continue
    }

    const from = participants.get(step.from)
    const to = participants.get(step.to)
    if (!from || !to) continue
    const labelHeight = step.label.length * LINE_HEIGHT
    const lineY = y + labelHeight + 6
    const dash = step.dashed ? ' stroke-dasharray="5 4"' : ''
    const marker = step.open ? `kern-arrow-open-${key}` : `kern-arrow-${key}`
    if (from === to) {
      // A message to oneself is a loop out to the right and back, which is what Mermaid draws too.
      const out = from.x + 34
      body.push(
        `<path d="M ${n(from.x)} ${n(lineY)} H ${n(out)} V ${n(lineY + 18)} H ${n(from.x)}" fill="none" stroke="currentColor" stroke-width="1.5"${dash} marker-end="url(#${marker})"/>`,
        textBlock(step.label, from.x + 46, lineY - 4, ' text-anchor="start"'),
      )
      y = lineY + 34
      continue
    }
    body.push(
      `<line x1="${n(from.x)}" y1="${n(lineY)}" x2="${n(to.x)}" y2="${n(lineY)}" stroke="currentColor" stroke-width="1.5"${dash} marker-end="url(#${marker})"/>`,
      textBlock(step.label, (from.x + to.x) / 2, lineY - 4 - labelHeight / 2),
    )
    y = lineY + STEP_HEIGHT - labelHeight > lineY + 12 ? lineY + STEP_HEIGHT - labelHeight : lineY + 24
  }

  const height = Math.max(y + MARGIN, first + STEP_HEIGHT)
  const lifelines = [...participants.values()]
    .map(
      (p) =>
        `<line class="kern-mermaid-lifeline" x1="${n(p.x)}" y1="${n(PARTICIPANT_TOP + PARTICIPANT_HEIGHT)}" x2="${n(p.x)}" y2="${n(height - MARGIN)}" stroke="currentColor" stroke-width="1" stroke-dasharray="3 4"/>`,
    )
    .join('')
  const heads = [...participants.values()]
    .map(
      (p) =>
        `<g><rect class="kern-mermaid-shape" x="${n(p.x - p.width / 2)}" y="${PARTICIPANT_TOP}" width="${n(p.width)}" height="${PARTICIPANT_HEIGHT}" rx="5" stroke="currentColor" stroke-width="1.5"/>${textBlock(p.lines, p.x, PARTICIPANT_TOP + PARTICIPANT_HEIGHT / 2)}</g>`,
    )
    .join('')

  return svg(width, height, key, `${lifelines}${heads}${body.join('')}`)
}

/* ---------------------------------------------------------------------------------------------- */
/* The element                                                                                      */
/* ---------------------------------------------------------------------------------------------- */

/**
 * The wrapper, with the two arrowheads this renderer uses.
 *
 * `width`/`height` are omitted in favour of a `viewBox` and `max-width: 100%` in the stylesheet, so
 * a wide diagram scales down on a phone instead of pushing the page sideways — which is the same
 * defect the table wrapper exists to prevent, and it is worst in Persian.
 */
function svg(width: number, height: number, key: string, body: string): MermaidSuccess {
  const w = Math.ceil(width)
  const h = Math.ceil(height)
  const defs =
    `<defs>` +
    `<marker id="kern-arrow-${key}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
    `<path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker>` +
    `<marker id="kern-arrow-open-${key}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
    `<path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="currentColor" stroke-width="1.5"/></marker>` +
    `</defs>`
  return {
    ok: true,
    width: w,
    height: h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" class="kern-mermaid" viewBox="0 0 ${w} ${h}" role="img">${defs}${body}</svg>`,
  }
}
