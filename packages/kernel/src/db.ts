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
      const schema = moduleSchemaName(moduleId)
      // Every process migrates the modules it hosts on boot, and Compose starts `core` and
      // `core-worker` together, so two of them apply the same folder at the same moment as a matter
      // of course. Without the lock they interleave and one fails on a relation the other has just
      // created. The lock is held on its own connection across the whole run — schema included,
      // because `create schema if not exists` races too — and the loser then finds nothing to apply.
      const lock = await pool.connect()
      try {
        await lock.query('select pg_advisory_lock(hashtext($1))', [`kern:migrate:${moduleId}`])
        await this.ensureSchema(schema)
        await migrate(db, {
          migrationsFolder: path.resolve(migrationsFolder),
          migrationsSchema: schema,
          migrationsTable: '__migrations',
        })
        opts.log.info({ module: moduleId, schema }, 'migrations applied')
      } finally {
        await lock.query('select pg_advisory_unlock(hashtext($1))', [`kern:migrate:${moduleId}`])
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
