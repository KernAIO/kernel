/**
 * The shape of a rich-text document, named structurally.
 *
 * Chat and tracker each declare their own `RichDoc` in their own contract, and they are the same
 * shape — a ProseMirror document. Shared helpers that work on one work on the other, so typing
 * against either module's would make the framework depend on a module and pick a winner arbitrarily.
 *
 * `catchall(unknown)` on both sides means anything assignable to one is assignable to this.
 *
 * If a third module grows rich text, the honest move is to lift this into `@kernhq/contracts` and
 * have all of them import it — the structural version is right for a framework helper and wrong as
 * a wire format.
 */
export interface RichDoc {
  type: 'doc'
  content?: Array<Record<string, unknown>>
  [key: string]: unknown
}
