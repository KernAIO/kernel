import path from 'node:path'
import { sql } from 'drizzle-orm'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { type PgSchema, pgSchema } from 'drizzle-orm/pg-core'
import pg from 'pg'
import type { Logger } from './logger.js'

export type Db = NodePgDatabase<Record<string, never>>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type DbOrTx = Db | Tx

export interface Database {
  db: Db
  pool: pg.Pool
  /**
   * Resolves once the connection has been checked against the thing every tenant policy depends on:
   * that row-level security applies to the role this process connects as.
   *
   * **Rejects in production when it does not.** See `checkRowLevelSecurity` — a superuser (or a role
   * with `BYPASSRLS`) skips every policy in the database, so a pool that connects as one makes every
   * `create policy` in every module decorative. Outside production it resolves after a warning,
   * because a laptop and CI both connect as the Postgres superuser and neither is holding anyone
   * else's data.
   *
   * `createKernel` awaits this before the first migration runs, so a refusal is a boot failure with
   * a readable message rather than a silent tenant leak.
   */
  ready(): Promise<void>
  /** Run `fn` in a transaction with RLS context `app.workspace_id` (and `app.user_id`) set for the connection. */
  withWorkspace<T>(
    workspaceId: string | null,
    fn: (tx: Tx) => Promise<T>,
    opts?: { userId?: string | null },
  ): Promise<T>
  /** Apply the migrations folder of a module into its own schema (`drizzle` bookkeeping table lives in that schema too). */
  migrateModule(moduleId: string, migrationsFolder: string): Promise<void>
  /**
   * The same, for a schema that is not a module's. A service that owns tables of its own — `collab`
   * and its Yjs documents — needs migrations for the same reasons a module does, and gets them
   * without pretending to be a module.
   */
  migrateSchema(schema: string, migrationsFolder: string, lockKey?: string): Promise<void>
  ensureSchema(name: string): Promise<void>
  close(): Promise<void>
}

/**
 * `create ... if not exists` is not atomic in Postgres: two sessions both see "not there", both
 * insert into the catalogue, and the loser gets a unique-violation instead of the no-op it asked
 * for. Every service boots at once, so treat "somebody else created it first" as success.
 */
export async function ignoringDuplicate<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn()
  } catch (err) {
    const code = (err as { code?: string }).code
    // 23505 unique_violation (catalogue race) · 42P06 duplicate_schema · 42P07 duplicate_table
    if (code === '23505' || code === '42P06' || code === '42P07') return undefined
    throw err
  }
}

/** Every module gets its own Postgres schema: `mod_<id>`. */
export const moduleSchema = (moduleId: string): PgSchema => pgSchema(`mod_${moduleId}`)
export const moduleSchemaName = (moduleId: string) => `mod_${moduleId}`

/** What the database says about the role this pool connects as. */
export interface RlsStatus {
  /** the role the connection actually authenticated as, which is not always the one in the URL */
  role: string
  superuser: boolean
  bypassRls: boolean
  /** false when Postgres will skip every row-level security policy for this connection */
  enforced: boolean
}

/** Ask the database who we are and whether policies bind us. `null` when the question could not be put. */
export async function inspectRls(pool: pg.Pool): Promise<RlsStatus | null> {
  const res = await pool.query<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>(
    'select rolname, rolsuper, rolbypassrls from pg_roles where rolname = current_user',
  )
  const row = res.rows[0]
  if (!row) return null
  const superuser = row.rolsuper === true
  const bypassRls = row.rolbypassrls === true
  return { role: row.rolname, superuser, bypassRls, enforced: !superuser && !bypassRls }
}

/**
 * The sentence an operator gets when the pool connects as a role row-level security does not apply
 * to. It has to name the role, because the URL frequently does not (`peer`, a `.pgpass`, a
 * `PGUSER`), and it has to say what to do, because "RLS is not enforced" is not actionable on its own.
 *
 * The prescription is two branches rather than a block of SQL, because the right action is entirely
 * different either side and the reader knows which side they are on. It used to be three statements
 * ending in `reassign owned by <current owner> to kern_app`, and almost nobody who reads this could
 * run them: on the shipped stack the current owner *is* the bootstrap superuser, and reassigning a
 * superuser's objects itself requires superuser — the exact privilege the reader is being told to
 * stop using. (`db-init` moves ownership with per-object `alter … owner to` loops that skip
 * extension-owned objects, which is why it can do what `reassign` cannot.)
 *
 * `vector` is named on purpose. It is the second cliff: an operator who creates the role by hand on
 * a fresh external database gets past this refusal and straight into `permission denied to create
 * extension "vector"` from core's `0000_init.sql`, with nothing pointing anywhere. Of the
 * extensions Kern uses, `pg_trgm`, `pgcrypto`, `ltree` and `btree_gist` are trusted and a
 * nosuperuser owner creates them fine; `vector` and `pg_stat_statements` are not.
 */
export function rlsNotEnforcedMessage(status: RlsStatus, databaseUrl?: string): string {
  const db = databaseUrl ? safeDatabaseName(databaseUrl) : '<database>'
  const why = status.superuser
    ? `"${status.role}" is a Postgres superuser`
    : `"${status.role}" has the BYPASSRLS attribute`
  return [
    `Row-level security is not in effect for this connection: ${why}.`,
    '',
    'Postgres skips every row-level security policy for such a role, and `force row level security`',
    'binds owners, not superusers. Every tenant policy this instance defines is therefore inert —',
    'a query for one workspace can read every other workspace’s rows.',
    '',
    'If you run the shipped docker-compose stack: update ~/kern to the current release files and run',
    '`docker compose up -d`. The db-init service creates the kern_app role and moves ownership of',
    `"${db}" to it (install.sh backfills KERN_DB_APP_PASSWORD into an existing .env).`,
    'Do not run SQL by hand.',
    '',
    'If DATABASE_URL points at your own Postgres: follow',
    'https://docs.kernaio.com/self-hosting/external-postgres/ — you will create a kern_app role, move',
    `ownership of "${db}" to it, and pre-create the \`vector\` extension, which needs your provider’s`,
    'admin role. Then point DATABASE_URL at kern_app.',
  ].join('\n')
}

/** The database name out of a connection URL, without carrying the credentials into a log line. */
function safeDatabaseName(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\//, '') || '<database>'
  } catch {
    return '<database>'
  }
}

/**
 * Refuse to serve production traffic on a connection row-level security does not apply to.
 *
 * Every shipped compose file used to connect as the Postgres container's superuser, and a superuser
 * bypasses RLS unconditionally — so the policies, the `force row level security` clauses and the
 * `set_config('app.workspace_id', …)` in `withWorkspace` were all correct and none of them ever
 * applied. Nothing failed; the isolation simply was not there. That is the failure mode this check
 * exists for: it is invisible from the code, from the schema and from the logs.
 *
 * Outside production it warns once and continues — a laptop and CI both connect as the superuser,
 * and neither is holding anyone else's data.
 */
export async function checkRowLevelSecurity(opts: {
  pool: pg.Pool
  log: Logger
  nodeEnv?: string
  url?: string
}): Promise<RlsStatus | null> {
  let status: RlsStatus | null
  try {
    status = await inspectRls(opts.pool)
  } catch (err) {
    // Could not ask — an unreachable database, a role with no `pg_roles` visibility. Migrations run
    // moments later and fail loudly on their own; refusing here would blame the wrong thing.
    opts.log.warn({ err }, 'could not determine whether row-level security applies to this connection')
    return null
  }
  if (!status) {
    opts.log.warn('current_user has no row in pg_roles; cannot tell whether row-level security applies')
    return null
  }
  if (status.enforced) return status
  const message = rlsNotEnforcedMessage(status, opts.url)
  if (opts.nodeEnv === 'production') throw new Error(message)
  opts.log.warn(
    { role: status.role, superuser: status.superuser, bypassRls: status.bypassRls },
    `${message}\n(Allowed here because NODE_ENV is not "production". A production boot refuses.)`,
  )
  return status
}

export function createDatabase(opts: {
  url: string
  max?: number
  log: Logger
  /** query-cost bounds for the request pool; migrations always run without them */
  timeouts?: { statementMs?: number; idleInTransactionMs?: number; lockMs?: number }
  /** `production` makes an unenforced row-level-security connection a boot failure */
  nodeEnv?: string
}): Database {
  const pool = new pg.Pool({
    connectionString: opts.url,
    max: opts.max ?? 20,
    application_name: 'kern',
    // One pool serves every tenant, so an unbounded query is an outage for all of them. Sent in the
    // startup packet: falsy means "leave Postgres' own default alone", which is no limit at all.
    statement_timeout: opts.timeouts?.statementMs || undefined,
    idle_in_transaction_session_timeout: opts.timeouts?.idleInTransactionMs || undefined,
    lock_timeout: opts.timeouts?.lockMs || undefined,
  })
  pool.on('error', (err) => opts.log.error({ err }, 'pg pool error'))
  const db = drizzle({ client: pool })
  // Kicked off with the pool rather than on first use: the answer must be in before anything
  // migrates or serves. The extra `catch` only stops Node reporting an unhandled rejection — the
  // rejection is still delivered to whoever awaits `ready()`.
  const rlsChecked = checkRowLevelSecurity({
    pool,
    log: opts.log,
    nodeEnv: opts.nodeEnv ?? process.env.NODE_ENV,
    url: opts.url,
  })
  rlsChecked.catch(() => {})

  // Opened the first time something migrates and closed with the database. Two connections is the
  // most it ever needs (the advisory lock, and drizzle applying the folder).
  let migrationPool: pg.Pool | undefined
  let migrationDb: Db | undefined
  const migrations = (): { pool: pg.Pool; db: Db } => {
    if (!migrationPool) {
      migrationPool = new pg.Pool({ connectionString: opts.url, max: 2, application_name: 'kern-migrate' })
      migrationPool.on('error', (err) => opts.log.error({ err }, 'pg migration pool error'))
      migrationDb = drizzle({ client: migrationPool })
    }
    return { pool: migrationPool, db: migrationDb as Db }
  }

  return {
    db,
    pool,
    async ready() {
      await rlsChecked
    },
    async withWorkspace(workspaceId, fn, o = {}) {
      return db.transaction(async (tx) => {
        await tx.execute(
          sql`select set_config('app.workspace_id', ${workspaceId ?? ''}, true), set_config('app.user_id', ${o.userId ?? ''}, true)`,
        )
        return fn(tx)
      })
    },
    async ensureSchema(name) {
      await ignoringDuplicate(() => db.execute(sql.raw(`create schema if not exists "${name}"`)))
    },
    async migrateModule(moduleId, migrationsFolder) {
      // The lock key stays the bare module id, not the schema name: during a rolling deploy an
      // older image is still taking `kern:migrate:<id>`, and a key that no longer matches would let
      // both apply the same folder at once.
      await this.migrateSchema(moduleSchemaName(moduleId), migrationsFolder, moduleId)
    },
    async migrateSchema(schema, migrationsFolder, lockKey) {
      // Every process migrates the schemas it owns on boot, and Compose starts `core` and
      // `core-worker` together, so two of them apply the same folder at the same moment as a matter
      // of course. Without the lock they interleave and one fails on a relation the other has just
      // created. The lock is held on its own connection across the whole run — schema included,
      // because `create schema if not exists` races too — and the loser then finds nothing to apply.
      //
      // Neither connection comes from the request pool, because that pool carries
      // `statement_timeout` and `lock_timeout`. Either one turns a slow but correct migration — an
      // index over a large table, or simply waiting out the peer that took the lock first — into a
      // cancelled statement, and a module migration that throws stops the whole host service from
      // booting, not just its own feature.
      //
      // The lock gets a connection of its own rather than one out of the migration pool: a waiter
      // holds its connection for as long as the winner takes, so pooling the two together lets N
      // concurrent migrations exhaust the pool and wait on each other for ever. Measured — four
      // concurrent `migrateModule` calls against a pool of two never returned.
      const key = `kern:migrate:${lockKey ?? schema}`
      const lock = new pg.Client({ connectionString: opts.url, application_name: 'kern-migrate-lock' })
      await lock.connect()
      try {
        await lock.query('select pg_advisory_lock(hashtext($1))', [key])
        const m = migrations()
        await ignoringDuplicate(() => m.db.execute(sql.raw(`create schema if not exists "${schema}"`)))
        await migrate(m.db, {
          migrationsFolder: path.resolve(migrationsFolder),
          migrationsSchema: schema,
          migrationsTable: '__migrations',
        })
        opts.log.info({ schema }, 'migrations applied')
      } finally {
        // Ending the connection releases a session-level advisory lock on its own; the explicit
        // unlock keeps the pairing visible and costs one statement.
        await lock.query('select pg_advisory_unlock(hashtext($1))', [key]).catch(() => {})
        await lock.end()
      }
    },
    async close() {
      await migrationPool?.end()
      await pool.end()
    },
  }
}

/** Common column helpers for module schemas. */
export { sql }
export const rlsPolicySql = (schema: string, table: string) => `
alter table "${schema}"."${table}" enable row level security;
alter table "${schema}"."${table}" force row level security;
create policy "${table}_ws_isolation" on "${schema}"."${table}"
  using (workspace_id::text = current_setting('app.workspace_id', true))
  with check (workspace_id::text = current_setting('app.workspace_id', true));
`
