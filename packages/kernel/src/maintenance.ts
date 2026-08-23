import { sql } from 'drizzle-orm'
import type { Database } from './db.js'
import { ignoringDuplicate } from './db.js'
import type { Logger } from './logger.js'

export interface MaintenanceState {
  reason: string
  version: string | null
  since: string
}

export interface Maintenance {
  /** create the table if it is not there yet; called once during boot, before migrations run */
  ensure(): Promise<void>
  /** hold the instance closed while something unsafe to serve through is happening */
  begin(reason: string, version?: string | null): Promise<void>
  end(): Promise<void>
  /** what the HTTP layer asks on every request — cached, so it costs one query per second at most */
  active(): Promise<MaintenanceState | null>
}

/**
 * The flag that lets an upgrade answer "come back in a moment" instead of failing requests.
 *
 * It lives in a kernel-owned schema rather than in core's, because the services that need to read
 * it are exactly the ones running while core is down applying migrations — a `kernel.call()` into
 * core would be the one call that cannot work at that moment.
 */
export function createMaintenance(opts: {
  database: Database
  log: Logger
  ttlMs?: number
  /** how long a maintenance window may last before it is ignored as abandoned */
  maxAgeMs?: number
}): Maintenance {
  const { database, log } = opts
  const ttl = opts.ttlMs ?? 1_000
  const maxAgeMs = opts.maxAgeMs ?? 30 * 60_000
  let cache: { v: MaintenanceState | null; exp: number } | null = null

  return {
    async ensure() {
      await database.ensureSchema('kern_platform')
      // every service runs this at boot at the same time; see `ignoringDuplicate`
      await ignoringDuplicate(() =>
        database.db.execute(
          sql.raw(`create table if not exists "kern_platform"."maintenance" (
          "id" boolean primary key default true check ("id"),
          "active" boolean not null default false,
          "reason" text not null default '',
          "version" text,
          "since" timestamptz not null default now()
        )`),
        ),
      )
    },
    async begin(reason, version = null) {
      await database.db.execute(sql`
        insert into "kern_platform"."maintenance" ("id", "active", "reason", "version", "since")
        values (true, true, ${reason}, ${version}, now())
        on conflict ("id") do update
          set "active" = true, "reason" = ${reason}, "version" = ${version}, "since" = now()`)
      cache = null
      log.warn({ reason, version }, 'maintenance mode on')
    },
    async end() {
      await database.db.execute(
        sql`update "kern_platform"."maintenance" set "active" = false, "reason" = '' where "id" = true`,
      )
      cache = null
      log.info('maintenance mode off')
    },
    async active() {
      if (cache && cache.exp > Date.now()) return cache.v
      let v: MaintenanceState | null = null
      try {
        const res = await database.db.execute(sql`
          select "reason", "version", "since" from "kern_platform"."maintenance"
          where "id" = true and "active" = true limit 1`)
        const row = (res.rows as Array<{ reason: string; version: string | null; since: string }>)[0]
        if (row) {
          const since = new Date(row.since)
          // An upgrade that dies between "on" and "off" would otherwise close the instance for good,
          // with no way in to turn it back on. It expires instead: a stuck flag costs a window, not
          // an outage that needs somebody with database access to end.
          if (Date.now() - since.getTime() > maxAgeMs) {
            log.warn({ since: row.since }, 'maintenance flag is stale; serving traffic again')
          } else {
            v = { reason: row.reason, version: row.version, since: since.toISOString() }
          }
        }
      } catch (err) {
        // an unreachable database is its own outage and the caller will find out; never turn a
        // failed read of this flag into a fake maintenance window
        log.debug({ err }, 'maintenance flag unreadable')
        v = null
      }
      cache = { v, exp: Date.now() + ttl }
      return v
    },
  }
}
