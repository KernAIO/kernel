import { getSchema } from '@tiptap/core'
import { common, createLowlight } from 'lowlight'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { PAGE_DOC_MARKS, PAGE_DOC_NODES } from './page-doc.js'
import { buildPageExtensions } from './page-schema.js'
import { buildExtensions } from './schema.js'

/**
 * Half of the contract between this package and `renderPageDoc` in @kernhq/module-quire.
 *
 * The renderer lives in another repository, so it cannot see this schema — it is checked against
 * the constants in `page-doc.ts` instead. That only works if the constants are true here, which is
 * what this file is for: add an extension that brings a node with it and this test fails in the
 * same commit, long before the renderer has a chance to be caught out by it.
 *
 * `getSchema` needs no DOM, which is what makes it a Node test rather than a browser one.
 */

const sorted = (o: object) => Object.keys(o).sort()

/** Everything switched on at once, to prove none of it moves the schema. */
const everything = () =>
  buildPageExtensions({
    placeholder: 'Write something',
    mentionSource: () => [],
    pageSource: () => [],
    onSuggest: () => {},
    onPageSuggest: () => {},
    lowlight: createLowlight(common),
    document: new Y.Doc(),
    // Never called: `render` runs when the plugin gets a view, and this test never makes one.
    dragHandleElement: {} as HTMLElement,
    onOutline: () => {},
  })

describe('buildPageExtensions', () => {
  it('produces exactly the nodes PAGE_DOC_NODES promises', () => {
    expect(sorted(getSchema(buildPageExtensions()).nodes)).toEqual([...PAGE_DOC_NODES].sort())
  })

  it('produces exactly the marks PAGE_DOC_MARKS promises', () => {
    expect(sorted(getSchema(buildPageExtensions()).marks)).toEqual([...PAGE_DOC_MARKS].sort())
  })

  /**
   * The bug this exists to prevent, which `buildExtensions` still has: a schema that depends on an
   * option. A page written on a surface with mentions must open on one without, or the mentions
   * are silently dropped the first time it is edited somewhere else.
   */
  it('builds the same schema whatever options it is given', () => {
    const bare = getSchema(buildPageExtensions())
    const full = getSchema(everything())
    expect(sorted(full.nodes)).toEqual(sorted(bare.nodes))
    expect(sorted(full.marks)).toEqual(sorted(bare.marks))
  })

  it('keeps the mention nodes whether or not a suggestion source is supplied', () => {
    const nodes = sorted(getSchema(buildPageExtensions()).nodes)
    expect(nodes).toContain('mention')
    expect(nodes).toContain('pageMention')
  })

  /** `lowlight` swaps a decoration plugin, never the node — including the attribute set. */
  it('gives codeBlock the same attributes with and without lowlight', () => {
    const attrsOf = (lowlight?: ReturnType<typeof createLowlight>) =>
      Object.keys(getSchema(buildPageExtensions({ lowlight })).nodes.codeBlock?.spec.attrs ?? {}).sort()
    expect(attrsOf(createLowlight(common))).toEqual(attrsOf())
    expect(attrsOf()).toContain('language')
  })

  it('allows all six heading levels', () => {
    const heading = getSchema(buildPageExtensions()).nodes.heading?.spec
    expect(heading?.attrs?.level?.default).toBe(1)
    // The parse rules are one per level, which is how the levels option reaches the schema.
    expect(heading?.parseDOM).toHaveLength(6)
  })

  /**
   * Undo belongs to Yjs on this schema. Two stacks race, and the winner is whichever plugin
   * registered last — which is how a collaborative editor ends up undoing somebody else's
   * paragraph. StarterKit's is switched off in the builder and cannot be switched back on.
   */
  it('carries no undo/redo extension of its own', () => {
    const names = buildPageExtensions().map((e) => (e as { name?: string }).name)
    expect(names).not.toContain('undoRedo')
  })

  it('adds the drag handle only when there is a document and an element to hang it on', () => {
    const names = (opts: Parameters<typeof buildPageExtensions>[0]) =>
      buildPageExtensions(opts).map((e) => (e as { name?: string }).name)
    expect(names({})).not.toContain('dragHandle')
    expect(names({ document: new Y.Doc() })).not.toContain('dragHandle')
    expect(names({ document: new Y.Doc(), dragHandleElement: {} as HTMLElement })).toContain('dragHandle')
  })

  /** The page schema has to be able to hold everything the narrow one can, or a quoted comment breaks. */
  it('is a superset of the narrow schema', () => {
    const narrow = getSchema(buildExtensions({ mentionSource: () => [] }))
    const page = getSchema(buildPageExtensions())
    for (const name of Object.keys(narrow.nodes)) expect(Object.keys(page.nodes)).toContain(name)
    for (const name of Object.keys(narrow.marks)) expect(Object.keys(page.marks)).toContain(name)
  })
})
