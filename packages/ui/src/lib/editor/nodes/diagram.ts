import { mergeAttributes, Node } from '@tiptap/core'
import { t } from '../../i18n.svelte.js'
import { renderMermaid } from '../mermaid.js'
import {
  DEFAULT_PAGE_DIAGRAM_KIND,
  PAGE_DIAGRAM_KINDS,
  PAGE_DIAGRAM_MAX_SOURCE,
  PAGE_DIAGRAM_MAX_TITLE,
  type PageDiagramKind,
} from '../page-doc.js'

/**
 * A diagram, stored as the thing somebody wrote.
 *
 * One node for three notations, because they differ in how they are *drawn* rather than in what
 * they are: each holds a source, a name and an optional saved picture, and a reader draws whichever
 * of those it can. Three node types would have meant three renderers, three Markdown writers and
 * three parity cases for one concept, and any future notation would need all of them again.
 *
 * **The source is the document, and the picture is a cache.** That ordering is the whole design:
 *
 *   - Mermaid is a notation, so `renderMermaid` draws it — here in the editor and again on the
 *     server, from the same function, so a writer sees exactly what a reader will. Nothing is
 *     stored except the text.
 *   - Excalidraw and Draw.io are editors. Drawing one faithfully means running it, which a page
 *     render cannot do, so those two carry `svgFileId`: the picture the editor exported, uploaded
 *     through the host's own file surface. The source still travels with it, because a picture with
 *     no source is a diagram nobody can ever change again.
 *
 * `href` is the third answer, for a diagram that lives somewhere else — a Draw.io document in a
 * drive, an Excalidraw room. A reader with no picture gets a link rather than a blank block, which
 * is the rule this node exists to keep: **a diagram always draws something.**
 *
 * The markup contract, matched character for character by `renderPageDoc` in @kernhq/module-quire:
 *
 *     <figure class="kern-diagram" data-diagram="mermaid" data-source="…" data-title="…">…</figure>
 *
 * `data-diagram` carries the kind *and* identifies the node, so `parseHTML` has one thing to match
 * on and pasted markup cannot produce a diagram by accident.
 */

/** Narrow an untrusted value to a kind. Exported so every side applies the identical rule. */
export const diagramKind = (value: unknown): PageDiagramKind =>
  PAGE_DIAGRAM_KINDS.includes(value as PageDiagramKind)
    ? (value as PageDiagramKind)
    : DEFAULT_PAGE_DIAGRAM_KIND

/**
 * A source, capped rather than refused.
 *
 * An Excalidraw scene grows with every stroke and the document it sits in is synchronised on every
 * keystroke, so an unbounded blob here is a page that stops loading. Truncating keeps the block —
 * with its title, its picture and its link — where rejecting would delete somebody's diagram at the
 * moment they saved it.
 */
export const diagramSource = (value: unknown): string =>
  typeof value === 'string' ? value.slice(0, PAGE_DIAGRAM_MAX_SOURCE) : ''

export const diagramTitle = (value: unknown): string | null => {
  const text = typeof value === 'string' ? value.trim().slice(0, PAGE_DIAGRAM_MAX_TITLE) : ''
  return text || null
}

/** A file id is a uuid; anything else never reaches a lookup. */
const FILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const diagramFileId = (value: unknown): string | null =>
  typeof value === 'string' && FILE_ID.test(value) ? value.toLowerCase() : null

export interface DiagramOptions {
  /**
   * Open the host's own diagram editor, resolving with what was saved — or null if nothing was.
   *
   * Supplied by the host for the same reason `pickImage` is: this package has no upload surface and
   * no Excalidraw, so a diagram it cannot draw needs somewhere for the writer to go. Without it a
   * diagram is still shown and still readable; it simply cannot be changed from here.
   */
  editDiagram?: (current: {
    kind: PageDiagramKind
    source: string
    title: string | null
    svgFileId: string | null
    href: string | null
  }) => Promise<{
    source?: string
    title?: string | null
    svgFileId?: string | null
    href?: string | null
  } | null>
}

/** What a card says about a diagram nobody can draw here. One sentence, in the writer's language. */
const kindLabel = (kind: PageDiagramKind): string =>
  kind === 'mermaid'
    ? t('editor.diagram_mermaid')
    : kind === 'excalidraw'
      ? t('editor.diagram_excalidraw')
      : t('editor.diagram_drawio')

export const Diagram = Node.create<DiagramOptions>({
  name: 'diagram',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return {}
  },

  addAttributes() {
    return {
      kind: {
        default: DEFAULT_PAGE_DIAGRAM_KIND,
        parseHTML: (element) => diagramKind(element.getAttribute('data-diagram')),
        renderHTML: (attrs) => ({ 'data-diagram': diagramKind(attrs.kind) }),
      },
      source: {
        default: '',
        parseHTML: (element) => diagramSource(element.getAttribute('data-source')),
        renderHTML: (attrs) => ({ 'data-source': diagramSource(attrs.source) }),
      },
      title: {
        default: null,
        parseHTML: (element) => diagramTitle(element.getAttribute('data-title')),
        renderHTML: (attrs) => {
          const title = diagramTitle(attrs.title)
          return title ? { 'data-title': title } : {}
        },
      },
      svgFileId: {
        default: null,
        parseHTML: (element) => diagramFileId(element.getAttribute('data-file-id')),
        renderHTML: (attrs) => {
          const id = diagramFileId(attrs.svgFileId)
          return id ? { 'data-file-id': id } : {}
        },
      },
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-href'),
        renderHTML: (attrs) => (attrs.href ? { 'data-href': String(attrs.href) } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-diagram]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes({ class: 'kern-diagram' }, HTMLAttributes)]
  },

  /**
   * The writer's own view of the diagram, drawn by the same function the server uses.
   *
   * Plain DOM rather than a Svelte component, exactly as the macro cards are: it runs inside
   * ProseMirror's lifecycle and draws one element per node, and mounting a component per diagram
   * would buy nothing but a teardown path to get wrong.
   *
   * A Mermaid source is drawn here; a broken one shows its own text and the reason, because a
   * writer who cannot see what went wrong will retype the whole diagram. The other two show their
   * saved picture where there is one and a labelled card where there is not, which is the same
   * thing the reader sees — the point being that nothing about a diagram looks different in the
   * editor from the way it will look on the page.
   */
  addNodeView() {
    return ({ editor, node, getPos }) => {
      const dom = document.createElement('figure')
      dom.className = 'kern-diagram kern-diagram-card'
      dom.contentEditable = 'false'
      const kind = diagramKind(node.attrs.kind)
      dom.setAttribute('data-diagram', kind)

      const body = document.createElement('div')
      body.className = 'kern-diagram-body'
      dom.append(body)

      if (kind === 'mermaid') {
        const drawn = renderMermaid(diagramSource(node.attrs.source))
        if (drawn.ok) {
          /*
           * Every character of this string was written by `mermaid.ts`, which escapes everything it
           * takes from the source — see the tests there. It is the one place in this package that
           * assigns markup, and it is assigning its own.
           */
          body.innerHTML = drawn.svg
        } else {
          const why = document.createElement('p')
          why.className = 'kern-diagram-message'
          why.textContent =
            drawn.reason === 'empty'
              ? t('editor.diagram_empty')
              : drawn.reason === 'unsupported'
                ? t('editor.diagram_unsupported')
                : t('editor.diagram_broken')
          const pre = document.createElement('pre')
          pre.textContent = diagramSource(node.attrs.source)
          body.append(why, pre)
        }
      } else {
        const label = document.createElement('p')
        label.className = 'kern-diagram-message'
        label.textContent = diagramFileId(node.attrs.svgFileId)
          ? kindLabel(kind)
          : `${kindLabel(kind)} — ${t('editor.diagram_no_picture')}`
        body.append(label)
      }

      const title = diagramTitle(node.attrs.title)
      if (title) {
        const caption = document.createElement('figcaption')
        caption.textContent = title
        dom.append(caption)
      }

      const edit = this.options.editDiagram
      if (edit) {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'kern-diagram-edit'
        button.textContent = t('editor.diagram_edit')
        button.addEventListener('click', () => {
          void edit({
            kind,
            source: diagramSource(node.attrs.source),
            title: diagramTitle(node.attrs.title),
            svgFileId: diagramFileId(node.attrs.svgFileId),
            href: typeof node.attrs.href === 'string' ? node.attrs.href : null,
          }).then((next) => {
            if (!next) return
            const pos = typeof getPos === 'function' ? getPos() : null
            if (pos === null || pos === undefined) return
            const view = editor.view
            view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...next }))
          })
        })
        dom.append(button)
      }

      return { dom }
    }
  },

  addCommands() {
    return {
      setDiagram:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    }
  },
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    diagram: {
      setDiagram: (attrs?: Record<string, unknown>) => ReturnType
    }
  }
}
