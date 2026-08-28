import { describe, expect, it } from 'vitest'
import { type MermaidRender, renderMermaid } from './mermaid.js'

/**
 * What this file is really checking is not that the picture is pretty.
 *
 * Three properties decide whether a server-side diagram renderer is safe to put on a published page,
 * and none of them is about the drawing:
 *
 *   1. **Nothing from the source reaches the output unescaped.** The SVG is written into a page as
 *      markup, so a node label is an injection site unless every character of it is escaped.
 *   2. **A source it cannot draw fails rather than drawing something else.** A subgraph silently
 *      flattened, an `alt` block silently dropped, a cylinder drawn as a rectangle — each of those
 *      is a diagram that reads as complete and says something the writer did not write.
 *   3. **The picture carries no colours of its own**, or it is black-on-white in dark mode.
 */

const ok = (result: MermaidRender): { svg: string } => {
  if (!result.ok) throw new Error(`expected a diagram, got ${result.reason} at line ${result.line}`)
  return result
}

describe('flowcharts', () => {
  it('draws nodes and edges from the source', () => {
    const { svg } = ok(renderMermaid('flowchart TD\n  A[Start] --> B[Finish]'))
    expect(svg).toContain('<svg')
    expect(svg).toContain('Start')
    expect(svg).toContain('Finish')
    expect(svg).toContain('<line')
    expect(svg).toContain('marker-end')
  })

  it('accepts every direction and the older `graph` keyword', () => {
    for (const header of ['flowchart TD', 'flowchart LR', 'graph TB', 'graph BT', 'graph RL', 'graph'])
      expect(renderMermaid(`${header}\n A --> B`).ok, header).toBe(true)
  })

  /** A left-to-right chart is wider than it is tall, which is the whole difference the flag makes. */
  it('lays a left-to-right chart out along the other axis', () => {
    const down = renderMermaid('flowchart TD\n A --> B --> C')
    const across = renderMermaid('flowchart LR\n A --> B --> C')
    if (!down.ok || !across.ok) throw new Error('both should draw')
    expect(across.width).toBeGreaterThan(down.width)
    expect(down.height).toBeGreaterThan(across.height)
  })

  it('draws every shape it claims to know, and refuses one it does not', () => {
    for (const body of ['A[Box]', 'A(Round)', 'A([Stadium])', 'A((Circle))', 'A{Decision}', 'A{{Hex}}'])
      expect(renderMermaid(`flowchart TD\n ${body} --> B`).ok, body).toBe(true)
    // A cylinder is a database, and a database drawn as a rectangle is a lie the output cannot own up to.
    const cylinder = renderMermaid('flowchart TD\n A[(Postgres)] --> B')
    expect(cylinder.ok).toBe(false)
  })

  it('carries an edge label written either way round', () => {
    expect(ok(renderMermaid('flowchart TD\n A -->|yes| B')).svg).toContain('yes')
    expect(ok(renderMermaid('flowchart TD\n A -- yes --> B')).svg).toContain('yes')
  })

  it('draws a dotted and a thick edge differently from a plain one', () => {
    expect(ok(renderMermaid('flowchart TD\n A -.-> B')).svg).toContain('stroke-dasharray')
    expect(ok(renderMermaid('flowchart TD\n A ==> B')).svg).toContain('stroke-width="3"')
    expect(ok(renderMermaid('flowchart TD\n A --> B')).svg).not.toContain('stroke-dasharray')
  })

  /** A line with no arrowhead is a line: the marker is what says which way the flow goes. */
  it('leaves the arrowhead off an open link', () => {
    expect(ok(renderMermaid('flowchart TD\n A --- B')).svg).not.toContain('marker-end')
  })

  it('takes a label from a later mention of the same node', () => {
    const { svg } = ok(renderMermaid('flowchart TD\n A --> B\n B[Deployed]'))
    expect(svg).toContain('Deployed')
  })

  /** A retry loop is a cycle, and a renderer that refuses one refuses a diagram people write daily. */
  it('draws a cycle rather than hanging or failing on it', () => {
    expect(renderMermaid('flowchart TD\n A --> B\n B --> C\n C --> A').ok).toBe(true)
  })

  it('accepts a chain written on one line', () => {
    const { svg } = ok(renderMermaid('flowchart LR\n A[One] --> B[Two] --> C[Three]'))
    expect(svg).toContain('One')
    expect(svg).toContain('Three')
  })

  it('ignores styling directives it has no use for', () => {
    expect(
      renderMermaid(
        'flowchart TD\n %% a comment\n classDef big fill:#f00\n A --> B\n style A fill:#eee\n click A "x"',
      ).ok,
    ).toBe(true)
  })
})

describe('sequence diagrams', () => {
  it('draws participants, lifelines and messages', () => {
    const { svg } = ok(
      renderMermaid(
        'sequenceDiagram\n participant S as Shell\n participant C as Core\n S->>C: sign in\n C-->>S: a session',
      ),
    )
    expect(svg).toContain('Shell')
    expect(svg).toContain('Core')
    expect(svg).toContain('sign in')
    expect(svg).toContain('kern-mermaid-lifeline')
  })

  it('draws a note over the participants it names', () => {
    const { svg } = ok(renderMermaid('sequenceDiagram\n A->>B: hi\n Note over A,B: they agree'))
    expect(svg).toContain('kern-mermaid-note')
    expect(svg).toContain('they agree')
  })

  it('draws a message somebody sends themselves', () => {
    expect(ok(renderMermaid('sequenceDiagram\n A->>A: retry')).svg).toContain('retry')
  })

  it('names participants nobody declared, in the order they are first used', () => {
    const { svg } = ok(renderMermaid('sequenceDiagram\n Browser->>Server: GET /\n Server-->>Browser: 200'))
    expect(svg.indexOf('Browser')).toBeLessThan(svg.indexOf('Server'))
  })
})

describe('what it refuses, and why that matters', () => {
  const reason = (source: string) => {
    const result = renderMermaid(source)
    return result.ok ? 'drew it' : result.reason
  }

  it('refuses a notation it does not draw rather than drawing an empty box', () => {
    expect(reason('pie title Votes\n "Yes" : 3')).toBe('unsupported')
    expect(reason('gantt\n title A')).toBe('unsupported')
    expect(reason('classDiagram\n A <|-- B')).toBe('unsupported')
  })

  /*
   * The two that would be tempting to skip over, and must not be. A subgraph is a box the writer
   * drew; an `alt` is a branch. Dropping either leaves a diagram that is not the one on the screen
   * and says nothing about what is missing.
   */
  it('refuses a flowchart with a subgraph rather than flattening it', () => {
    expect(reason('flowchart TD\n subgraph api\n A --> B\n end')).toBe('unsupported')
  })

  it('refuses a sequence diagram with a frame rather than dropping the frame', () => {
    expect(reason('sequenceDiagram\n loop every minute\n A->>B: poll\n end')).toBe('unsupported')
    expect(reason('sequenceDiagram\n alt happy\n A->>B: ok\n end')).toBe('unsupported')
    expect(reason('sequenceDiagram\n A->>B: hi\n activate B')).toBe('unsupported')
  })

  it('says a source is empty when there is nothing in it', () => {
    expect(reason('')).toBe('empty')
    expect(reason('   \n %% just a comment\n')).toBe('empty')
    expect(reason('flowchart TD')).toBe('empty')
  })

  it('says a source is not Mermaid when it is not', () => {
    expect(reason('flowchart TD\n A --> [oops')).toBe('syntax')
    expect(reason('sequenceDiagram\n participant %%%')).toBe('unsupported')
  })

  it('names the line a failure belongs to, so the writer can find it', () => {
    const result = renderMermaid('flowchart TD\n A --> B\n subgraph x\n end')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.line).toBe(3)
  })

  it('refuses a diagram too big to be worth drawing on every page read', () => {
    const many = Array.from({ length: 200 }, (_, i) => ` N${i} --> N${i + 1}`).join('\n')
    expect(reason(`flowchart TD\n${many}`)).toBe('unsupported')
  })
})

describe('the output is safe to write into a page', () => {
  /**
   * The property the whole feature rests on: this SVG is emitted **unescaped** by `renderPageDoc`,
   * because it is markup. So a label somebody typed must not be able to end the picture.
   */
  it('escapes a label that tries to close the svg', () => {
    const { svg } = ok(renderMermaid('flowchart TD\n A["</svg><script>alert(1)</script>"] --> B'))
    expect(svg).not.toContain('<script')
    expect(svg).not.toContain('</svg><')
    expect(svg).toContain('&lt;/svg&gt;')
    // Exactly one closing tag, and it is the one this file wrote.
    expect(svg.match(/<\/svg>/g)).toHaveLength(1)
  })

  it('escapes both quote characters, so an attribute cannot be broken out of', () => {
    const { svg } = ok(renderMermaid(`flowchart TD\n A["a\\" onload=\\"x"] --> B`))
    expect(svg).not.toContain('onload="')
    expect(svg).toContain('&quot;')
  })

  it('escapes an edge label and a participant name too', () => {
    expect(ok(renderMermaid('flowchart TD\n A -->|"<b>x</b>"| B')).svg).toContain('&lt;b&gt;')
    expect(ok(renderMermaid('sequenceDiagram\n A->>B: <i>go</i>')).svg).toContain('&lt;i&gt;')
  })

  /**
   * No colour of its own, or the diagram is black on white in dark mode — one of the defects the
   * project treats as a bug rather than as polish.
   */
  it('paints with currentColor and nothing else', () => {
    const { svg } = ok(renderMermaid('flowchart TD\n A[One] -->|then| B{Two}\n B --> C((Three))'))
    expect(svg).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(svg).not.toMatch(/\brgb\(|\bhsl\(/)
    expect(svg).toContain('currentColor')
  })

  /** Two diagrams on one page must not share a marker id, or one redraws the other's arrowheads. */
  it('gives each source its own marker ids', () => {
    const first = ok(renderMermaid('flowchart TD\n A --> B')).svg
    const second = ok(renderMermaid('flowchart TD\n C --> D')).svg
    const idOf = (svg: string) => /id="(kern-arrow-[a-z0-9]+)"/.exec(svg)?.[1]
    expect(idOf(first)).toBeDefined()
    expect(idOf(first)).not.toBe(idOf(second))
    // …and the same source always draws the same one, so a render is reproducible.
    expect(idOf(ok(renderMermaid('flowchart TD\n A --> B')).svg)).toBe(idOf(first))
  })

  it('scales to the page rather than pushing it sideways', () => {
    const { svg } = ok(renderMermaid('flowchart LR\n A[A very long label indeed] --> B'))
    expect(svg).toContain('viewBox="0 0 ')
    // No `width`/`height` attributes on the root: the stylesheet caps it at the measure.
    expect(/<svg[^>]*\swidth=/.test(svg)).toBe(false)
  })
})
