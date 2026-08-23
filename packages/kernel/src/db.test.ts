/**
 * Concurrent migration of the same module.
 *
 * Every process migrates the modules it hosts on boot. Compose starts `core` and `core-worker`
 * together, and a cloud rollout starts several replicas at once, so "two processes apply the same
 * folder at the same moment" is the normal case, not an edge one. Without a lock they interleave
 * and one of them fails on a relation the other has just created — a boot loop that looks like a
 * broken migration rather than a race.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDatabase, type Database, moduleSchemaName } from './db.js'
import { createLogger } from './logger.js'

const BASE_URL = process.env.DATABASE_URL
const MODULE_ID = 'locktest'

/** A throwaway drizzle migrations folder: two statements that both fail loudly if applied twice. */
function fixtureMigrations(): string {
  const dir = mkdtempSync(join(tmpdir(), 'kern-migrations-'))
  mkdirSync(join(dir, 'meta'))
  writeFileSync(
    join(dir, '0000_init.sql'),
    `create table "mod_${MODULE_ID}"."widgets" ("id" uuid primary key);`,
  )
  writeFileSync(
    join(dir, '0001_more.sql'),
    `alter table "mod_${MODULE_ID}"."widgets" add column "name" text;`,
  )
  writeFileSync(
    join(dir, 'meta', '_journal.json'),
    JSON.stringify({
      version: '7',
      dialect: 'postgresql',
      entries: [
        { idx: 0, version: '7', when: 1, tag: '0000_init', breakpoints: true },
        { idx: 1, version: '7', when: 2, tag: '0001_more', breakpoints: true },
      ],
    }),
  )
  return dir
}

describe.skipIf(!BASE_URL)('migrateModule under concurrency', () => {
  let dbName: string
  let url: string
  let database: Database

  beforeAll(async () => {
    dbName = `kern_migratelock_${Date.now().toString(36)}`
    const admin = new pg.Client({ connectionString: BASE_URL })
    await admin.connect()
    await admin.query(`create database "${dbName}"`)
    await admin.end()
    const u = new URL(BASE_URL as string)
    u.pathname = `/${dbName}`
    url = u.toString()
    database = createDatabase({ url, log: createLogger('test') })
  })

  afterAll(async () => {
    await database?.close()
    const admin = new pg.Client({ connectionString: BASE_URL })
    await admin.connect()
    await admin.query(`drop database if exists "${dbName}" with (force)`)
    await admin.end()
  })

  it('lets four processes migrate at once and applies everything exactly once', async () => {
    const folder = fixtureMigrations()
    await Promise.all(Array.from({ length: 4 }, () => database.migrateModule(MODULE_ID, folder)))

    const applied = await database.db.execute(
      `select count(*)::int as n from "${moduleSchemaName(MODULE_ID)}"."__migrations"`,
    )
    expect((applied.rows[0] as { n: number }).n).toBe(2)

    const columns = await database.db.execute(
      `select column_name from information_schema.columns
       where table_schema = '${moduleSchemaName(MODULE_ID)}' and table_name = 'widgets'`,
    )
    expect(columns.rows.map((r) => (r as { column_name: string }).column_name).sort()).toEqual(['id', 'name'])
  })
})

// Missing infrastructure is a fine reason to skip on a laptop and a dishonest one in CI.
describe('migration lock test coverage', () => {
  it('has a database to run against when CI is set', () => {
    if (process.env.CI) expect(BASE_URL, 'DATABASE_URL must be set in CI').toBeTruthy()
  })
})
