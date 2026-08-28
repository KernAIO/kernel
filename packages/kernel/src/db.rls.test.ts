/**
 * Whether row-level security is in effect at all.
 *
 * Every tenant table in Kern carries `enable row level security`, `force row level security` and a
 * `workspace_id = current_setting('app.workspace_id')` policy, and `withWorkspace` sets that
 * setting on the connection. All of it is correct. None of it applied, because every shipped compose
 * file connected as the Postgres container's superuser and **a superuser bypasses RLS
 * unconditionally** — `force` binds owners, not superusers. Nothing failed; the isolation simply was
 * not there, and no test, type-check or log line could see it.
 *
 * So this test does not check the check. It creates a role that is not a superuser, gives it the
 * database, and shows the *rows* differ: one workspace for the owner, both for the superuser, from
 * the same query against the same table. Then it shows the guard trips for exactly the second case.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { checkRowLevelSecurity, createDatabase, type Database, inspectRls, rlsPolicySql } from './db.js'
import type { Logger } from './logger.js'

const BASE_URL = process.env.DATABASE_URL
const SCHEMA = 'mod_rlstest'
const WS_A = '01920000-0000-7000-8000-00000000000a'
const WS_B = '01920000-0000-7000-8000-00000000000b'

/**
 * A logger that records rather than prints. Built as a plain object, not spread from pino — a pino
 * instance keeps its machinery on symbol-keyed properties and `{ ...logger }` produces something
 * that looks like a logger and throws on the first call.
 */
function recorder(): Logger & { warnings: unknown[][] } {
  const warnings: unknown[][] = []
  const noop = () => {}
  return {
    warnings,
    warn: (...args: unknown[]) => {
      warnings.push(args)
    },
    info: noop,
    error: noop,
    debug: noop,
    trace: noop,
    fatal: noop,
    child: () => recorder(),
  } as unknown as Logger & { warnings: unknown[][] }
}
const quiet = recorder()

describe.skipIf(!BASE_URL)('row-level security and the role the pool connects as', () => {
  const suffix = Date.now().toString(36)
  const dbName = `kern_rls_${suffix}`
  const roleName = `kern_app_${suffix}`
  const password = 'rls-test-password'
  let superuserUrl: string
  let appUrl: string
  let asSuperuser: Database
  let asOwner: Database

  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: BASE_URL })
    await admin.connect()
    await admin.query(`create database "${dbName}"`)
    // The role under test: exactly what the fix asks an operator to create.
    await admin.query(
      `create role "${roleName}" login password '${password}' nosuperuser nobypassrls nocreatedb`,
    )
    await admin.query(`alter database "${dbName}" owner to "${roleName}"`)
    await admin.end()

    const u = new URL(BASE_URL as string)
    u.pathname = `/${dbName}`
    superuserUrl = u.toString()
    const a = new URL(superuserUrl)
    a.username = roleName
    a.password = password
    appUrl = a.toString()

    // Build the tenant table the way every module's migration does, and hand it to the app role so
    // `force row level security` has an owner to bind.
    const setup = new pg.Client({ connectionString: superuserUrl })
    await setup.connect()
    await setup.query(`create schema "${SCHEMA}"`)
    await setup.query(
      `create table "${SCHEMA}"."widgets" (id uuid primary key default gen_random_uuid(), workspace_id uuid not null, name text not null)`,
    )
    await setup.query(rlsPolicySql(SCHEMA, 'widgets'))
    await setup.query(
      `insert into "${SCHEMA}"."widgets" (workspace_id, name) values ($1,'a-1'),($1,'a-2'),($2,'b-1')`,
      [WS_A, WS_B],
    )
    await setup.query(`alter schema "${SCHEMA}" owner to "${roleName}"`)
    await setup.query(`alter table "${SCHEMA}"."widgets" owner to "${roleName}"`)
    await setup.end()

    asSuperuser = createDatabase({ url: superuserUrl, log: quiet })
    asOwner = createDatabase({ url: appUrl, log: quiet })
  })

  afterAll(async () => {
    await asSuperuser?.close()
    await asOwner?.close()
    const admin = new pg.Client({ connectionString: BASE_URL })
    await admin.connect()
    await admin.query(`drop database if exists "${dbName}" with (force)`)
    await admin.query(`drop role if exists "${roleName}"`)
    await admin.end()
  })

  const widgetsIn = async (database: Database, workspaceId: string) =>
    database.withWorkspace(workspaceId, async (tx) => {
      const res = await tx.execute(`select name from "${SCHEMA}"."widgets" order by name`)
      return res.rows.map((r) => (r as { name: string }).name)
    })

  it('isolates the workspace for a role the policies bind', async () => {
    expect(await widgetsIn(asOwner, WS_A)).toEqual(['a-1', 'a-2'])
    expect(await widgetsIn(asOwner, WS_B)).toEqual(['b-1'])
  })

  /**
   * The defect, stated as an assertion rather than as a worry: the same query, the same table, the
   * same `app.workspace_id`, and every other tenant's rows come back.
   */
  it('hands a superuser every workspace’s rows from the same query', async () => {
    expect(await widgetsIn(asSuperuser, WS_A)).toEqual(['a-1', 'a-2', 'b-1'])
  })

  it('reports the connection honestly', async () => {
    const owner = await inspectRls(asOwner.pool)
    expect(owner).toMatchObject({ role: roleName, superuser: false, bypassRls: false, enforced: true })
    const su = await inspectRls(asSuperuser.pool)
    expect(su?.enforced).toBe(false)
    expect(su?.superuser).toBe(true)
  })

  describe('the guard', () => {
    it('passes in production for the non-superuser owner', async () => {
      await expect(
        checkRowLevelSecurity({ pool: asOwner.pool, log: quiet, nodeEnv: 'production', url: appUrl }),
      ).resolves.toMatchObject({ enforced: true })
    })

    it('refuses to start in production for the superuser, naming the role and the fix', async () => {
      const err = await checkRowLevelSecurity({
        pool: asSuperuser.pool,
        log: quiet,
        nodeEnv: 'production',
        url: superuserUrl,
      }).then(
        () => null,
        (e: Error) => e,
      )
      expect(err).toBeInstanceOf(Error)
      const message = err?.message ?? ''
      expect(message).toContain('Row-level security is not in effect')
      // the actual role, which the URL does not always carry
      expect(message).toContain(new URL(BASE_URL as string).username)
      expect(message).toContain(dbName)

      // Both branches, because the reader is on exactly one of them and neither action fits the other.
      expect(message).toContain('docker compose up -d')
      expect(message).toContain('https://docs.kernaio.com/self-hosting/external-postgres/')
      // The second cliff: `vector` is the one untrusted extension core's 0000_init.sql creates, so
      // an external database needs it pre-created by an admin role. Nothing else warns about it.
      expect(message).toContain('vector')

      // A prescription the reader cannot execute is not a prescription: `reassign owned by` needs
      // superuser when the current owner is one, which on the shipped stack it always is.
      expect(message).not.toMatch(/reassign owned by/i)
    })

    /** A laptop and CI both connect as the superuser. Neither may be stopped by this. */
    it('warns and continues outside production', async () => {
      const noisy = recorder()
      await expect(
        checkRowLevelSecurity({ pool: asSuperuser.pool, log: noisy, nodeEnv: 'development' }),
      ).resolves.toMatchObject({ enforced: false })
      expect(noisy.warnings).toHaveLength(1)
    })

    /** `ready()` is what `createKernel` awaits before the first migration runs. */
    it('is what `ready()` resolves, so a bad connection fails the boot rather than a request', async () => {
      const production = createDatabase({ url: superuserUrl, log: quiet, nodeEnv: 'production' })
      try {
        await expect(production.ready()).rejects.toThrow('Row-level security is not in effect')
      } finally {
        await production.close()
      }
      const fine = createDatabase({ url: appUrl, log: quiet, nodeEnv: 'production' })
      try {
        await expect(fine.ready()).resolves.toBeUndefined()
      } finally {
        await fine.close()
      }
    })
  })

  /**
   * The bounds exist so one tenant's pathological query cannot occupy the pool. Asserted against
   * what Postgres reports, not against what was passed in — pg sends them in the startup packet and
   * a silently ignored option would look identical from here.
   */
  describe('query-cost bounds', () => {
    it('are set on the request pool', async () => {
      const bounded = createDatabase({
        url: appUrl,
        log: quiet,
        timeouts: { statementMs: 1_500, idleInTransactionMs: 2_500, lockMs: 500 },
      })
      try {
        const res = await bounded.pool.query<{ name: string; setting: string }>(
          `select name, setting from pg_settings where name in ('statement_timeout','idle_in_transaction_session_timeout','lock_timeout')`,
        )
        const settings = Object.fromEntries(res.rows.map((r) => [r.name, r.setting]))
        expect(settings).toEqual({
          statement_timeout: '1500',
          idle_in_transaction_session_timeout: '2500',
          lock_timeout: '500',
        })
      } finally {
        await bounded.close()
      }
    })

    it('actually cancel a statement that runs past them', async () => {
      const bounded = createDatabase({ url: appUrl, log: quiet, timeouts: { statementMs: 250 } })
      try {
        await expect(bounded.pool.query('select pg_sleep(3)')).rejects.toThrow(/statement timeout/i)
      } finally {
        await bounded.close()
      }
    })

    /**
     * And do not reach migrations. A `statement_timeout` that killed an index build would turn a
     * slow but correct migration into a host service that never boots — the thing that fails hardest
     * in this codebase, because one module's migration takes the other four down with it.
     */
    it('are off on the connections migrations run on', async () => {
      const bounded = createDatabase({
        url: appUrl,
        log: quiet,
        timeouts: { statementMs: 250, idleInTransactionMs: 250, lockMs: 250 },
      })
      try {
        await bounded.migrateSchema('rls_migration_probe', emptyMigrations())
        // the migration pool is open now; it must not carry any of the three
        const res = await bounded.pool.query('select 1')
        expect(res.rowCount).toBe(1)
        const probe = new pg.Pool({ connectionString: appUrl, application_name: 'probe' })
        try {
          const running = await probe.query<{ n: string }>(
            `select count(*)::text as n from pg_stat_activity where application_name = 'kern-migrate'`,
          )
          expect(Number(running.rows[0]?.n)).toBeGreaterThan(0)
        } finally {
          await probe.end()
        }
      } finally {
        await bounded.close()
      }
    })
  })
})

/** A migrations folder with one statement slower than the bound above. */
function emptyMigrations(): string {
  const dir = mkdtempSync(join(tmpdir(), 'kern-rls-migrations-'))
  mkdirSync(join(dir, 'meta'))
  writeFileSync(join(dir, '0000_slow.sql'), 'select pg_sleep(1);')
  writeFileSync(
    join(dir, 'meta', '_journal.json'),
    JSON.stringify({
      version: '7',
      dialect: 'postgresql',
      entries: [{ idx: 0, version: '7', when: 1, tag: '0000_slow', breakpoints: true }],
    }),
  )
  return dir
}

// Missing infrastructure is a fine reason to skip on a laptop and a dishonest one in CI.
describe('row-level security test coverage', () => {
  it('has a database to run against when CI is set', () => {
    if (process.env.CI) expect(BASE_URL, 'DATABASE_URL must be set in CI').toBeTruthy()
  })
})
