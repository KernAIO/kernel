import type { RichDoc } from './doc.js'

/**
 * Turning what somebody typed into a mention the server can act on.
 *
 * A mention is not decoration. `@dan` in a message is why Dan's inbox lights up, why the channel
 * shows a mention badge rather than an unread one, and why he is notified even when the channel is
 * muted. The server reads that from a `mention` node in the document — plain text saying "@dan"
 * does nothing at all.
 *
 * The composer is a plain textarea, so this is how the two meet: when somebody picks a person from
 * the menu, the composer records the exact text it inserted alongside the user id. On send, those
 * recorded runs become `mention` nodes and everything else stays text. Editing the inserted text
 * breaks the match, and the mention degrades to plain text — which is honest, because at that point
 * it is no longer the name that was picked.
 */

export interface PickedMention {
  /** exactly what was inserted into the textarea, including the leading @ */
  literal: string
  userId: string
  label: string
}

/** `@channel`, `@here` and `@all` reach everyone; the server reads them from the text itself. */
export const EVERYONE_TOKENS = ['channel', 'here', 'all'] as const

export interface MentionQuery {
  /** what has been typed after the `@`, lowercased */
  query: string
  /** index of the `@` in the text */
  start: number
  /** index just past the caret */
  end: number
}

/**
 * Is the caret inside an `@…` that should be offering suggestions?
 *
 * An `@` only starts a mention at the beginning of the text or after whitespace, so an email
 * address does not open the menu. The query stops at whitespace: once you type a space the menu is
 * done, whether or not you picked anyone.
 */
export function mentionQueryAt(text: string, caret: number): MentionQuery | null {
  const upToCaret = text.slice(0, caret)
  const at = upToCaret.lastIndexOf('@')
  if (at === -1) return null

  const before = at === 0 ? '' : (upToCaret[at - 1] as string)
  if (before && !/\s/.test(before)) return null

  const query = upToCaret.slice(at + 1)
  if (/\s/.test(query)) return null
  if (query.length > 40) return null

  return { query: query.toLowerCase(), start: at, end: caret }
}

export interface MentionCandidate {
  id: string
  name: string
  username?: string | null
  avatarUrl?: string | null
}

/**
 * People matching what has been typed, best first.
 *
 * A name that starts with the query beats one that merely contains it, because somebody typing
 * `@da` means Dan far more often than they mean Amanda.
 */
export function rankCandidates(people: MentionCandidate[], query: string, limit = 8): MentionCandidate[] {
  if (!query) return people.slice(0, limit)
  const scored: Array<{ person: MentionCandidate; score: number }> = []
  for (const person of people) {
    const name = person.name.toLowerCase()
    const username = (person.username ?? '').toLowerCase()
    let score = -1
    if (username?.startsWith(query)) score = 0
    else if (name.startsWith(query)) score = 1
    else if (name.split(/\s+/).some((part) => part.startsWith(query))) score = 2
    else if (username.includes(query)) score = 3
    else if (name.includes(query)) score = 4
    if (score >= 0) scored.push({ person, score })
  }
  scored.sort((a, b) => a.score - b.score || a.person.name.localeCompare(b.person.name))
  return scored.slice(0, limit).map((s) => s.person)
}

/** What gets typed into the box when somebody is picked. A username is unique; a name may not be. */
export function literalFor(person: MentionCandidate): string {
  return `@${person.username || person.name}`
}

interface TextNode {
  type: 'text'
  text: string
}
interface MentionNode {
  type: 'mention'
  attrs: { kind: 'user'; id: string; label: string }
}
type Inline = TextNode | MentionNode | { type: 'hardBreak' }

/**
 * Build the document to send: the typed text, with every recorded mention turned back into a node.
 *
 * Only mentions that still appear literally in the text survive. A run is matched at a word
 * boundary, so `@dan` does not match inside `@daniel`.
 */
export function textToDoc(text: string, picked: PickedMention[]): RichDoc {
  const byLength = [...picked].sort((a, b) => b.literal.length - a.literal.length)

  const inlineFor = (line: string): Inline[] => {
    if (!line) return []
    const out: Inline[] = []
    let index = 0
    while (index < line.length) {
      let matched: PickedMention | null = null
      let matchedAt = -1
      for (const mention of byLength) {
        const found = line.indexOf(mention.literal, index)
        if (found === -1) continue
        const after = line[found + mention.literal.length]
        if (after && /[\w@]/.test(after)) continue // part of a longer word
        if (matchedAt === -1 || found < matchedAt) {
          matched = mention
          matchedAt = found
        }
      }
      if (!matched || matchedAt === -1) {
        out.push({ type: 'text', text: line.slice(index) })
        break
      }
      if (matchedAt > index) out.push({ type: 'text', text: line.slice(index, matchedAt) })
      out.push({
        type: 'mention',
        attrs: { kind: 'user', id: matched.userId, label: matched.label },
      })
      index = matchedAt + matched.literal.length
    }
    return out
  }

  const paragraphs = text.split('\n').map((line) => {
    const content = inlineFor(line)
    return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
  })

  return { type: 'doc', content: paragraphs } as RichDoc
}

/**
 * The mentions already in a document, as the composer's `picked` list.
 *
 * Editing goes through a textarea, so a mention becomes the literal `@Name` again. Without this the
 * next `textToDoc` has nothing to match and every existing mention is silently demoted to text —
 * the person stops being notified and nobody sees that it happened.
 */
export function mentionsIn(doc: unknown): PickedMention[] {
  const out: PickedMention[] = []
  const seen = new Set<string>()
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }
    if (n.type === 'mention') {
      const userId = String(n.attrs?.id ?? '')
      const label = String(n.attrs?.label ?? '')
      if (userId && label && !seen.has(userId)) {
        seen.add(userId)
        out.push({ userId, label, literal: `@${label}` })
      }
    }
    for (const child of n.content ?? []) walk(child)
  }
  for (const child of (doc as { content?: unknown[] } | null)?.content ?? []) walk(child)
  return out
}
