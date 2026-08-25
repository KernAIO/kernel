import { describe, expect, it } from 'vitest'
import type { RichDoc } from './doc.js'
import {
  literalFor,
  type MentionCandidate,
  mentionQueryAt,
  mentionsIn,
  rankCandidates,
  textToDoc,
} from './mentions'

const people: MentionCandidate[] = [
  { id: 'u1', name: 'Dan Brekke', username: 'dan' },
  { id: 'u2', name: 'Amanda Fields', username: 'amanda' },
  { id: 'u3', name: 'Inés Cabrera', username: 'ines' },
  { id: 'u4', name: 'Tomás Lindqvist', username: null },
]

describe('spotting an @ the caret is inside', () => {
  it('offers suggestions at the start of the text', () => {
    expect(mentionQueryAt('@da', 3)).toEqual({ query: 'da', start: 0, end: 3 })
  })

  it('offers suggestions after a space', () => {
    expect(mentionQueryAt('hello @da', 9)?.query).toBe('da')
  })

  it('offers everyone when nothing has been typed yet', () => {
    expect(mentionQueryAt('@', 1)?.query).toBe('')
  })

  it('leaves an email address alone', () => {
    expect(mentionQueryAt('write to dan@example.com', 24)).toBeNull()
  })

  it('stops at a space, so a finished mention does not keep the menu open', () => {
    expect(mentionQueryAt('@dan says hello', 15)).toBeNull()
  })

  it('reads the @ nearest the caret, not the first one in the line', () => {
    expect(mentionQueryAt('@dan and @in', 12)).toEqual({ query: 'in', start: 9, end: 12 })
  })

  it('ignores an @ after the caret', () => {
    expect(mentionQueryAt('hello @dan', 5)).toBeNull()
  })
})

describe('ranking people', () => {
  it('puts a username match first', () => {
    expect(rankCandidates(people, 'dan')[0]?.id).toBe('u1')
  })

  it('prefers a name that starts with the query over one that contains it', () => {
    const ranked = rankCandidates(people, 'am')
    expect(ranked[0]?.id).toBe('u2')
  })

  it('matches a surname', () => {
    expect(rankCandidates(people, 'cab')[0]?.id).toBe('u3')
  })

  it('matches people who have no username', () => {
    expect(rankCandidates(people, 'tom')[0]?.id).toBe('u4')
  })

  it('offers everybody before anything is typed', () => {
    expect(rankCandidates(people, '')).toHaveLength(4)
  })
})

describe('what gets inserted', () => {
  it('uses the username, because two people can share a name', () => {
    expect(literalFor(people[0] as MentionCandidate)).toBe('@dan')
  })

  it('falls back to the name when there is no username', () => {
    expect(literalFor(people[3] as MentionCandidate)).toBe('@Tomás Lindqvist')
  })
})

describe('building the document that is sent', () => {
  const picked = [{ literal: '@dan', userId: 'u1', label: 'Dan Brekke' }]

  /** the inline content of the first paragraph, which is what every case below looks at */
  const firstLine = (doc: RichDoc): Array<Record<string, unknown>> => {
    const paragraph = doc.content?.[0] as { content?: Array<Record<string, unknown>> } | undefined
    return paragraph?.content ?? []
  }

  it('turns a picked mention into a node the server acts on', () => {
    const doc = textToDoc('hey @dan look at this', picked)
    const content = firstLine(doc)
    expect(content[0]).toEqual({ type: 'text', text: 'hey ' })
    expect(content[1]).toEqual({
      type: 'mention',
      attrs: { kind: 'user', id: 'u1', label: 'Dan Brekke' },
    })
    expect(content[2]).toEqual({ type: 'text', text: ' look at this' })
  })

  it('leaves text alone when nothing was picked', () => {
    const doc = textToDoc('hey @dan', [])
    const content = firstLine(doc)
    expect(content).toEqual([{ type: 'text', text: 'hey @dan' }])
  })

  it('does not match inside a longer word', () => {
    const doc = textToDoc('ask @daniel instead', picked)
    const content = firstLine(doc)
    expect(content).toEqual([{ type: 'text', text: 'ask @daniel instead' }])
  })

  it('handles the same person mentioned twice', () => {
    const doc = textToDoc('@dan and @dan', picked)
    const content = firstLine(doc)
    expect(content.filter((n) => n.type === 'mention')).toHaveLength(2)
  })

  it('keeps each line its own paragraph', () => {
    const doc = textToDoc('first\nsecond', [])
    expect(doc.content).toHaveLength(2)
  })

  it('prefers the longer literal when one name contains another', () => {
    const overlapping = [
      { literal: '@dan', userId: 'u1', label: 'Dan' },
      { literal: '@dana', userId: 'u9', label: 'Dana' },
    ]
    const doc = textToDoc('hi @dana', overlapping)
    const content = firstLine(doc)
    expect(content[1]).toMatchObject({ attrs: { id: 'u9' } })
  })
})

describe('mentionsIn', () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'over to ' },
          { type: 'mention', attrs: { kind: 'user', id: 'u-1', label: 'Dan Brekke' } },
          { type: 'text', text: ' and ' },
          { type: 'mention', attrs: { kind: 'user', id: 'u-2', label: 'Maya Rivera' } },
        ],
      },
    ],
  }

  it('recovers the mentions a document already carries', () => {
    expect(mentionsIn(doc)).toEqual([
      { userId: 'u-1', label: 'Dan Brekke', literal: '@Dan Brekke' },
      { userId: 'u-2', label: 'Maya Rivera', literal: '@Maya Rivera' },
    ])
  })

  it('round-trips an edit without demoting a mention to text', () => {
    // This is what editing does: document → text → document.
    const asText = 'over to @Dan Brekke and @Maya Rivera'
    const again = textToDoc(asText, mentionsIn(doc))
    const kinds = (again.content?.[0] as { content?: Array<{ type?: string }> })?.content?.map((n) => n.type)
    expect(kinds).toEqual(['text', 'mention', 'text', 'mention'])
  })

  it('answers for a document with no mentions, and for nothing at all', () => {
    expect(mentionsIn({ type: 'doc', content: [] })).toEqual([])
    expect(mentionsIn(null)).toEqual([])
  })
})
