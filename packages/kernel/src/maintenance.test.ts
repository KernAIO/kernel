/**
 * The upgrade flag, and the two ways it must not make things worse.
 *
 * It closes the API on purpose, so the failure modes matter more than the happy path: a database it
 * cannot read must not invent a maintenance window, and a window nobody ever closed — an upgrade
 * that died between "on" and "off" — must expire rather than lock everybody out of an instance whose
 * only remaining way in is psql.
 */
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDatabase, type Database } from './db.js'
import { createLogger } from './logger.js'
import { createMaintenance } from './maintenance.js'

const BASE_URL = process.env.DATABASE_URL

describe.skipIf(!BASE_URL)('maintenance', () => {
  let dbName: string
  let database: Database

  beforeAll(async () => {
    dbName = `kern_maintenance_${Date.now().toString(36)}`
    const admin = new pg.Client({ connectionString: BASE_URL })
    await admin.connect()
    await admin.query(`create database "${dbName}"`)
    await admin.end()
    const u = new URL(BASE_URL as string)
    u.pathname = `/${dbName}`
    database = createDatabase({ url: u.toString(), log: createLogger('test') })
  })

  afterAll(async () => {
    await database?.close()
    const admin = new pg.Client({ connectionString: BASE_URL })
    await admin.connect()
    await admin.query(`drop database if exists "${dbName}" with (force)`)
    await admin.end()
  })

  it('is off until something turns it on, and reports why while it is on', async () => {
    const m = createMaintenance({ database, log: createLogger('test'), ttlMs: 0 })
    await m.ensure()
    expect(await m.active()).toBeNull()

    await m.begin('Kern is being upgraded', '1.2.0')
    const state = await m.active()
    expect(state?.reason).toBe('Kern is being upgraded')
    expect(state?.version).toBe('1.2.0')

    await m.end()
    expect(await m.active()).toBeNull()
  })

  it('survives every service calling ensure() at the same moment', async () => {
    const boots = Array.from({ length: 4 }, () =>
      createMaintenance({ database, log: createLogger('test'), ttlMs: 0 }),
    )
    await expect(Promise.all(boots.map((m) => m.ensure()))).resolves.toBeDefined()
  })

  it('expires a window nobody closed instead of locking the instance out', async () => {
    const m = createMaintenance({ database, log: createLogger('test'), ttlMs: 0, maxAgeMs: 60_000 })
    await m.ensure()
    await m.begin('upgrade that never finished')
    expect(await m.active()).not.toBeNull()

    await database.db.execute(
      `update "kern_platform"."maintenance" set "since" = now() - interval '2 hours' where "id" = true`,
    )
    expect(await m.active()).toBeNull()
    await m.end()
  })

  it('does not invent a window when the flag cannot be read', async () => {
    const broken = createDatabase({
      url: 'postgres://nobody:nobody@127.0.0.1:1/none',
      log: createLogger('test'),
    })
    const m = createMaintenance({ database: broken, log: createLogger('test'), ttlMs: 0 })
    expect(await m.active()).toBeNull()
    await broken.close().catch(() => {})
  })
})

// Missing infrastructure is a fine reason to skip on a laptop and a dishonest one in CI.
describe('maintenance test coverage', () => {
  it('has a database to run against when CI is set', () => {
    if (process.env.CI) expect(BASE_URL, 'DATABASE_URL must be set in CI').toBeTruthy()
  })
})
