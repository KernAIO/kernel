import { mergeAttributes, Node } from '@tiptap/core'
import { t } from '../../i18n.svelte.js'
import {
  PAGE_EMBED_MAX_DESCRIPTION,
  PAGE_EMBED_MAX_SITE,
  PAGE_EMBED_MAX_TITLE,
  PAGE_EMBED_MAX_URL,
  PAGE_OBJECT_REF,
} from '../page-doc.js'

/**
 * The two ways a page points at something that is not a page.
 *
 * They look alike on screen and are opposites underneath, which is why they are two nodes rather
 * than one with a flag:
 *
 * **`embed` is a public URL and its unfurl.** The server fetched the address once — through an
 * allow-listed, redirect-checking unfurl in @kernhq/module-quire — and what came back is stored in
 * the document like any other prose the writer typed. There is no permission attached to a headline
 * from a public web page, so there is nobody to ask at render time and nothing to withhold; a
 * reader with no network sees the same card as everybody else. Storing it is also what keeps the
 * *renderer* from ever making a request: the fetch happens once, in a procedure a member called,
 * rather than on every read of every published page.
 *
 * **`objectEmbed` is one of Kern's own objects, by reference and nothing else.** An issue, a page, a
 * channel — `<module>:<type>:<id>`, the same spelling `objectRefToString` produces. It deliberately
 * holds **no title**, because whether a given reader may be told what that issue is called is a
 * question only the server can answer, against that reader, at the moment of reading. So it is a
 * *reading macro* — it is in `PAGE_DOC_READING_MACROS`, it draws a fail-closed frame, and a render
 * with no resolver shows the frame and nothing else. That is the whole reason Kern's own things are
 * not unfurled: fetching our own URL would turn a permission question into a cached answer, and it
 * would point the server's fetcher at the server.
 *
 * The markup contract, matched by `renderPageDoc`:
 *
 *     <div class="kern-embed" data-embed data-url="…" data-title="…" data-site="…">…</div>
 *     <div class="kern-macro" data-macro="object" data-ref="quire:page:…"></div>
 */

const trimmed = (value: unknown, max: number): string | null => {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
  return text || null
}

export const embedTitle = (value: unknown): string | null => trimmed(value, PAGE_EMBED_MAX_TITLE)
export const embedDescription = (value: unknown): string | null => trimmed(value, PAGE_EMBED_MAX_DESCRIPTION)
export const embedSite = (value: unknown): string | null => trimmed(value, PAGE_EMBED_MAX_SITE)

/**
 * The address, kept as text and never trusted as a link here.
 *
 * The read side runs it through `safeHref`, which is the only thing that decides whether it becomes
 * an anchor — so this narrows the length and nothing else. Two places deciding what a safe URL is
 * would be two answers, and the one that matters is the one nearest the output.
 */
export const embedUrl = (value: unknown): string =>
  typeof value === 'string' ? value.trim().slice(0, PAGE_EMBED_MAX_URL) : ''

export const objectRef = (value: unknown): string | null =>
  typeof value === 'string' && PAGE_OBJECT_REF.test(value) ? value : null

/** `quire:page:…` → `page`, for a card that can say what kind of thing it points at. */
export const objectRefType = (ref: string | null): string | null => ref?.split(':')[1] ?? null

const atom = {
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
} as const

export const Embed = Node.create({
  name: 'embed',
  ...atom,

  addAttributes() {
    return {
      url: {
        default: '',
        parseHTML: (element) => embedUrl(element.getAttribute('data-url')),
        renderHTML: (attrs) => ({ 'data-url': embedUrl(attrs.url) }),
      },
      title: {
        default: null,
        parseHTML: (element) => embedTitle(element.getAttribute('data-title')),
        renderHTML: (attrs) => {
          const title = embedTitle(attrs.title)
          return title ? { 'data-title': title } : {}
        },
      },
      description: {
        default: null,
        parseHTML: (element) => embedDescription(element.getAttribute('data-description')),
        renderHTML: (attrs) => {
          const text = embedDescription(attrs.description)
          return text ? { 'data-description': text } : {}
        },
      },
      siteName: {
        default: null,
        parseHTML: (element) => embedSite(element.getAttribute('data-site')),
        renderHTML: (attrs) => {
          const site = embedSite(attrs.siteName)
          return site ? { 'data-site': site } : {}
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-embed]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ class: 'kern-embed', 'data-embed': '' }, HTMLAttributes)]
  },

  /** The card the writer sees is the card the reader sees: a headline, a site and a sentence. */
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'kern-embed kern-embed-card'
      dom.contentEditable = 'false'
      dom.setAttribute('data-embed', '')

      const url = embedUrl(node.attrs.url)
      const title = document.createElement('span')
      title.className = 'kern-embed-title'
      title.textContent = embedTitle(node.attrs.title) ?? url ?? t('editor.embed_untitled')
      dom.append(title)

      const site = embedSite(node.attrs.siteName)
      if (site) {
        const where = document.createElement('span')
        where.className = 'kern-embed-site'
        where.textContent = site
        dom.append(where)
      }

      const description = embedDescription(node.attrs.description)
      if (description) {
        const body = document.createElement('p')
        body.className = 'kern-embed-description'
        body.textContent = description
        dom.append(body)
      }
      return { dom }
    }
  },

  addCommands() {
    return {
      setEmbed:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    }
  },
})

export interface ObjectEmbedOptions {
  /**
   * What this session already knows an object is called, for the editor's card only.
   *
   * Resolved live by the host and **never stored**, exactly as `pageLabel` is for the macros that
   * name a page: a title written into the document outlives the permission that allowed it, travels
   * into every export and is drawn by a renderer that never asked anybody. Returning null — which is
   * the default — leaves the card saying what kind of thing it points at without saying which,
   * which is the honest fallback.
   */
  objectLabel?: (ref: string) => string | null
}

export const ObjectEmbed = Node.create<ObjectEmbedOptions>({
  name: 'objectEmbed',
  ...atom,

  addOptions() {
    return {}
  },

  addAttributes() {
    return {
      ref: {
        default: null,
        parseHTML: (element) => objectRef(element.getAttribute('data-ref')),
        renderHTML: (attrs) => {
          const ref = objectRef(attrs.ref)
          return ref ? { 'data-ref': ref } : {}
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-macro="object"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ class: 'kern-macro', 'data-macro': 'object' }, HTMLAttributes)]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'kern-macro kern-macro-card'
      dom.contentEditable = 'false'
      dom.setAttribute('data-macro-card', 'puzzle')

      const ref = objectRef(node.attrs.ref)
      const name = document.createElement('span')
      name.className = 'kern-macro-name'
      name.textContent = t('editor.embed_object')
      const detail = document.createElement('span')
      detail.className = 'kern-macro-detail'
      /*
       * Three cases, and the middle one is why: an object this session cannot name is not the same
       * as no object at all. Saying "nothing chosen" about a card that does point somewhere is a lie
       * the writer acts on — they point it again, and replace the one that was already right.
       */
      const named = ref ? (this.options.objectLabel?.(ref) ?? null) : null
      detail.textContent = ref
        ? (named ?? objectRefType(ref) ?? t('editor.embed_object_other'))
        : t('editor.embed_object_none')
      dom.append(name, detail)
      return { dom }
    }
  },

  addCommands() {
    return {
      setObjectEmbed:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    }
  },
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    embeds: {
      setEmbed: (attrs?: Record<string, unknown>) => ReturnType
      setObjectEmbed: (attrs?: Record<string, unknown>) => ReturnType
    }
  }
}
