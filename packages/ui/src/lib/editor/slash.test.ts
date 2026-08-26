import { getSchema } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { PAGE_DOC_NODES } from './page-doc.js'
import { buildPageExtensions } from './page-schema.js'
import { filterSlashItems, SLASH_STRUCTURAL_NODES, slashInsertableNodes, slashItems } from './slash.js'

/**
 * The claim the slash menu makes: every block a page can hold, a person can type.
 *
 * It was not true before there was a menu at all — callouts, tables and toggles were in the schema
 * and in the renderer with no way in — and the way it stops being true again is somebody adding a
 * node to `PAGE_DOC_NODES` and not adding the item that inserts it. So the two lists are checked
 * against each other, and the only escape is naming the node in `SLASH_STRUCTURAL_NODES` and saying
 * there why nobody inserts it directly.
 */

/** Everything switched on, which is what makes the coverage claim a claim about the whole schema. */
const everything = { pageMentions: true, pickImage: async () => null }

describe('the slash menu', () => {
  it('can insert every node the page schema holds', () => {
    const insertable = new Set(slashInsertableNodes(everything))
    const structural = new Set<string>(SLASH_STRUCTURAL_NODES)
    const unreachable = PAGE_DOC_NODES.filter((n) => !insertable.has(n) && !structural.has(n))
    expect(unreachable).toEqual([])
  })

  it('claims nothing the schema does not have', () => {
    const nodes = new Set(Object.keys(getSchema(buildPageExtensions()).nodes))
    for (const name of [...slashInsertableNodes(everything), ...SLASH_STRUCTURAL_NODES]) {
      expect(nodes, `${name} is not in the page schema`).toContain(name)
    }
  })

  it('does not call a node structural and insert it too', () => {
    const insertable = new Set(slashInsertableNodes(everything))
    expect(SLASH_STRUCTURAL_NODES.filter((n) => insertable.has(n))).toEqual([])
  })

  /** The two entries that depend on the host being able to answer them. */
  it('offers the image and page-link entries only when the host can serve them', () => {
    const bare = slashItems().map((i) => i.id)
    expect(bare).not.toContain('image')
    expect(bare).not.toContain('pageMention')
    const full = slashItems(everything).map((i) => i.id)
    expect(full).toContain('image')
    expect(full).toContain('pageMention')
  })

  it('matches on the label and on the keywords behind it', () => {
    const ids = (q: string) => filterSlashItems(q, everything).map((i) => i.id)
    expect(ids('table')).toContain('table')
    // "bullet" is the word people type; the label says "Bulleted list".
    expect(ids('bullet')).toContain('bulletList')
    // A keyword the label never contains.
    expect(ids('todo')).toContain('taskList')
    expect(ids('TABLE')).toContain('table')
    expect(ids('')).toEqual(slashItems(everything).map((i) => i.id))
    expect(ids('zzzz')).toEqual([])
  })

  it('gives every item something to draw and something to run', () => {
    for (const item of slashItems(everything)) {
      expect(item.label, item.id).not.toBe('')
      // `t()` returns the key when a string is missing, which is how a gap shows up here.
      expect(item.label, `${item.id} has no translation`).not.toMatch(/^(editor|common)\./)
      expect(item.group, item.id).not.toMatch(/^editor\./)
      expect(item.icon, item.id).not.toBe('')
      expect(typeof item.run, item.id).toBe('function')
    }
  })
})
