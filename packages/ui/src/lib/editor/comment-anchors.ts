import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  ySyncPluginKey,
} from '@tiptap/y-tiptap'
import * as Y from 'yjs'

/**
 * Anchoring a comment to a piece of a collaborative document.
 *
 * A character offset names a place that only exists while nobody else is typing: two words inserted
 * above and the comment is attached to text it was never about. A Yjs *relative* position points at
 * the content itself, so it survives concurrent editing — and survives the text being deleted, in
 * which case it resolves to nothing and the interface can say the thread is orphaned rather than
 * highlighting an arbitrary sentence.
 *
 * The encoding is base64 so a position can be stored in a JSON column and sent over the wire.
 */

export interface CommentRange {
  id: string
  /** base64 `Y.encodeRelativePosition` */
  from: string
  to: string
  resolved?: boolean
}

const encode = (pos: Y.RelativePosition) => Buffer.from(Y.encodeRelativePosition(pos)).toString('base64')
const decode = (value: string) => Y.decodeRelativePosition(new Uint8Array(Buffer.from(value, 'base64')))

/**
 * The current selection as a pair of relative positions, or null when nothing is selected.
 *
 * `ySyncPluginKey` carries the binding between the ProseMirror document and the Yjs type; without
 * it there is no way to translate one coordinate space into the other.
 */
export function selectionToAnchor(state: {
  selection: { from: number; to: number }
  doc: unknown
}): { from: string; to: string } | null {
  const binding = ySyncPluginKey.getState(state as never)
  if (!binding?.type || !binding.binding?.mapping) return null
  const { from, to } = (state as { selection: { from: number; to: number } }).selection
  if (from === to) return null
  return {
    from: encode(absolutePositionToRelativePosition(from, binding.type, binding.binding.mapping)),
    to: encode(absolutePositionToRelativePosition(to, binding.type, binding.binding.mapping)),
  }
}

/** Where an anchor points now, or null if the text it referred to is gone. */
export function anchorToRange(
  state: unknown,
  doc: Y.Doc,
  anchor: { from: string; to: string },
): { from: number; to: number } | null {
  const binding = ySyncPluginKey.getState(state as never)
  if (!binding?.type || !binding.binding?.mapping) return null
  const from = relativePositionToAbsolutePosition(
    doc,
    binding.type,
    decode(anchor.from),
    binding.binding.mapping,
  )
  const to = relativePositionToAbsolutePosition(doc, binding.type, decode(anchor.to), binding.binding.mapping)
  if (from === null || to === null || from >= to) return null
  return { from, to }
}

export const commentAnchorsKey = new PluginKey<{ ranges: CommentRange[] }>('kern-comment-anchors')

export interface CommentAnchorOptions {
  doc: Y.Doc | null
  /** read on every redraw, so the host can hand over whatever it has loaded */
  ranges: () => CommentRange[]
  /** which thread is open, so it can be drawn differently from the rest */
  active: () => string | null
  onClick?: (id: string) => void
}

/**
 * Draws the highlights.
 *
 * Decorations rather than marks: a comment is not part of the document, and storing it as a mark
 * would put one person's annotation into everybody's content — and into every export.
 */
export const CommentAnchors = Extension.create<CommentAnchorOptions>({
  name: 'kernCommentAnchors',
  addOptions() {
    return { doc: null, ranges: () => [], active: () => null }
  },
  addProseMirrorPlugins() {
    const options = this.options
    return [
      new Plugin({
        key: commentAnchorsKey,
        props: {
          decorations(state) {
            const doc = options.doc
            if (!doc) return DecorationSet.empty
            const active = options.active()
            const decorations: Decoration[] = []
            for (const range of options.ranges()) {
              if (range.resolved) continue
              const at = anchorToRange(state, doc, range)
              if (!at) continue
              decorations.push(
                Decoration.inline(at.from, at.to, {
                  class: `kern-comment-mark${range.id === active ? ' active' : ''}`,
                  'data-comment-id': range.id,
                }),
              )
            }
            return DecorationSet.create(state.doc, decorations)
          },
          handleClick(_view, _pos, event) {
            const el = (event.target as HTMLElement)?.closest?.('[data-comment-id]')
            const id = el?.getAttribute('data-comment-id')
            if (id) {
              options.onClick?.(id)
              return true
            }
            return false
          },
        },
      }),
    ]
  },
})
