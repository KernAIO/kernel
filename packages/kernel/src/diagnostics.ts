import type { ServerModule } from './module.js'

/**
 * What a module actually registered, as data.
 *
 * Every module ships a test that walks its contract and its router and refuses to let them drift.
 * That check is worth running against a *live* instance too — it answers "is the thing I just built
 * actually wired up", which is the question somebody developing a module asks every few minutes and
 * which nothing could answer before. `admin.listModules` reported a manifest and a hardcoded
 * `healthy: true`.
 *
 * Nothing here calls a procedure or touches the database: the router is inspected, not invoked.
 */

/** An oRPC procedure carries `~orpc`; a router group does not. */
interface Leaf {
  '~orpc': {
    route?: { method?: string; path?: string }
    middlewares?: unknown[]
  }
}

const isLeaf = (node: unknown): node is Leaf =>
  typeof node === 'object' && node !== null && '~orpc' in node

/** `{ notes: { list, create } }` → `{ 'notes.list': leaf, 'notes.create': leaf }` */
function leaves(node: unknown, path: string[] = []): Record<string, Leaf> {
  if (isLeaf(node)) return { [path.join('.')]: node }
  if (typeof node !== 'object' || node === null) return {}
  return Object.entries(node).reduce<Record<string, Leaf>>(
    (acc, [key, value]) => Object.assign(acc, leaves(value, [...path, key])),
    {},
  )
}

export interface ProcedureReport {
  name: string
  method: string | null
  path: string | null
  /**
   * How many middlewares stand in front of it.
   *
   * A module following the template has two — `workspaceScoped()` and `requires()` — and its own
   * test asserts that. This is a *live* report across every module, and core deliberately differs:
   * `admin.*` calls `requireInstanceAdmin` inside the handler, and the dashboard procedures are
   * membership-only because they touch the caller's own row. So the count is shown rather than
   * judged, and only *nothing at all* is called a problem.
   */
  middlewares: number
  /** false only when nothing stands in front of it */
  gated: boolean
}

export interface ModuleReport {
  id: string
  name: string
  version: string
  /** false when the module is enabled somewhere but hosted by a different service */
  hostedHere: boolean
  host: string | null
  procedures: ProcedureReport[]
  /** declared in the contract and never implemented — these type-check and 404 */
  missing: string[]
  /** implemented and never declared — unreachable over HTTP */
  undeclared: string[]
  permissions: string[]
  events: string[]
  /** callable by other modules through `kernel.call()` */
  callable: string[]
  jobs: string[]
  subscriptions: string[]
  objectTypes: string[]
  notificationTypes: string[]
  hasMigrations: boolean
  hasSchema: boolean
  /**
   * Procedures anybody can call without signing in.
   *
   * Not a fault — health checks, an invitation preview and the push key are meant to be reachable —
   * but the list nobody keeps, and the one worth looking at. A procedure that ends up here by
   * accident is the kind of mistake that is invisible until somebody finds it.
   */
  public: string[]
  /** everything wrong, in the words somebody can act on */
  problems: string[]
}

export function describeModule(mod: ServerModule, service: string): ModuleReport {
  const def = mod.definition
  const declared = mod.contract ? leaves(mod.contract) : {}
  // The router is built with a kernel it never uses here, because nothing is called.
  let implemented: Record<string, Leaf> = {}
  let routerError: string | null = null
  try {
    implemented = mod.router ? leaves(mod.router({} as never)) : {}
  } catch (err) {
    routerError = err instanceof Error ? err.message : String(err)
  }

  const procedures: ProcedureReport[] = Object.entries(implemented)
    .map(([name, leaf]) => {
      const middlewares = leaf['~orpc'].middlewares?.length ?? 0
      return {
        name,
        method: leaf['~orpc'].route?.method ?? null,
        path: leaf['~orpc'].route?.path ?? null,
        middlewares,
        gated: middlewares > 0,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const comparable = Boolean(mod.contract)
  const missing = comparable ? Object.keys(declared).filter((n) => !(n in implemented)).sort() : []
  const undeclared = comparable ? Object.keys(implemented).filter((n) => !(n in declared)).sort() : []

  const problems: string[] = []
  if (routerError) problems.push(`the router could not be inspected: ${routerError}`)
  /*
   * `contract` is optional on ServerModule, and a module that omits it cannot be checked against
   * anything — so say that, rather than reporting every implemented procedure as undeclared, which
   * is what a naive comparison against an empty contract does.
   */
  if (!mod.contract && mod.router) {
    problems.push('the contract is not attached to the server module, so nothing can be checked against it')
  }
  for (const name of missing) problems.push(`${name} is in the contract and not in the router`)
  for (const name of undeclared) problems.push(`${name} is in the router and not in the contract`)

  if (mod.schema && !mod.migrationsFolder) problems.push('declares tables but no migrations folder')
  for (const event of Object.values(def.events ?? {})) {
    const name = typeof event === 'string' ? event : event.name
    if (!name.startsWith(`${def.id}.`)) problems.push(`event ${name} is not prefixed ${def.id}.`)
  }
  for (const perm of def.permissions ?? []) {
    if (!perm.key.startsWith(`${def.id}.`)) problems.push(`permission ${perm.key} is not prefixed ${def.id}.`)
  }

  return {
    id: def.id,
    name: def.name,
    version: def.version,
    hostedHere: true,
    host: service,
    procedures,
    missing,
    undeclared,
    permissions: (def.permissions ?? []).map((p) => p.key).sort(),
    events: Object.values(def.events ?? {})
      .map((e) => (typeof e === 'string' ? e : e.name))
      .sort(),
    callable: Object.keys(mod.procedures ?? {})
      .map((name) => `${def.id}.${name}`)
      .sort(),
    jobs: (mod.jobs ?? []).map((j) => j.name).sort(),
    subscriptions: Object.keys(mod.subscriptions ?? {}).sort(),
    objectTypes: (def.objectTypes ?? []).map((o) => (typeof o === 'string' ? o : o.type)).sort(),
    notificationTypes: (def.notificationTypes ?? []).map((n) => n.type).sort(),
    public: procedures.filter((p) => !p.gated).map((p) => p.name),
    hasMigrations: Boolean(mod.migrationsFolder),
    hasSchema: Boolean(mod.schema),
    problems,
  }
}
