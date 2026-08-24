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

export function createDatabase(opts: { url: string; max?: number; log: Logger }): Database {
  const pool = new pg.Pool({ connectionString: opts.url, max: opts.max ?? 20, application_name: 'kern' })
  pool.on('error', (err) => opts.log.error({ err }, 'pg pool error'))
  const db = drizzle({ client: pool })
  return {
    db,
    pool,
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
      const lock = await pool.connect()
      try {
        const key = `kern:migrate:${lockKey ?? schema}`
        await lock.query('select pg_advisory_lock(hashtext($1))', [key])
        await this.ensureSchema(schema)
        await migrate(db, {
          migrationsFolder: path.resolve(migrationsFolder),
          migrationsSchema: schema,
          migrationsTable: '__migrations',
        })
        opts.log.info({ schema }, 'migrations applied')
      } finally {
        await lock.query('select pg_advisory_unlock(hashtext($1))', [`kern:migrate:${lockKey ?? schema}`])
        lock.release()
      }
    },
    async close() {
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
