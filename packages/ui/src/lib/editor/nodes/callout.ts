import { mergeAttributes, Node } from '@tiptap/core'

/**
 * A callout — the boxed aside a wiki uses for "note this", "careful here", "this went wrong".
 *
 * Tiptap ships no such node, so the markup is decided here and copied on the read side. That
 * pairing is the whole contract, and it is worth stating exactly rather than leaving to be
 * inferred from this file:
 *
 *     <aside class="kern-callout" data-callout="warning"> …block content… </aside>
 *
 * `data-callout` carries the tone *and* identifies the node, so `parseHTML` has one thing to match
 * on and pasted HTML cannot produce a callout by accident. `renderPageDoc` in @kernhq/module-quire
 * emits the same two attributes in the same order, and `.kern-prose .kern-callout` in prose.css is
 * what dresses both.
 */

/**
 * The tones, closed on purpose.
 *
 * Each one maps to a colour pair in prose.css, so a document carrying anything else would render
 * untinted — and an open set would also put an arbitrary document string into a class name. An
 * unknown tone falls back to `info` on both sides rather than rendering something undressed.
 */
export const CALLOUT_TONES = ['info', 'note', 'success', 'warning', 'danger'] as const
export type CalloutTone = (typeof CALLOUT_TONES)[number]

export const DEFAULT_CALLOUT_TONE: CalloutTone = 'info'

/** Narrow an untrusted value to a tone. Exported so the renderer applies the identical rule. */
export function calloutTone(value: unknown): CalloutTone {
  return CALLOUT_TONES.includes(value as CalloutTone) ? (value as CalloutTone) : DEFAULT_CALLOUT_TONE
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  /*
   * `block+` rather than `inline*`: a callout holds paragraphs, lists and code, which is most of
   * what people put in one. `defining` keeps it intact when its contents are replaced — without
   * it, selecting everything inside a callout and typing deletes the callout too.
   */
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      tone: {
        default: DEFAULT_CALLOUT_TONE,
        parseHTML: (element) => calloutTone(element.getAttribute('data-callout')),
        renderHTML: (attributes) => ({ 'data-callout': calloutTone(attributes.tone) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'aside[data-callout]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes({ class: 'kern-callout' }, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setCallout:
        (tone: CalloutTone = DEFAULT_CALLOUT_TONE) =>
        ({ commands }) =>
          commands.wrapIn(this.name, { tone }),
      toggleCallout:
        (tone: CalloutTone = DEFAULT_CALLOUT_TONE) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, { tone }),
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    }
  },
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (tone?: CalloutTone) => ReturnType
      toggleCallout: (tone?: CalloutTone) => ReturnType
      unsetCallout: () => ReturnType
    }
  }
}
