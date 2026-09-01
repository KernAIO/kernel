import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { GenericContainer, type StartedTestContainer } from 'testcontainers'

/**
 * Test infrastructure helpers. Prefer the shared dev infra (`pnpm infra`) when DATABASE_URL is set;
 * fall back to Testcontainers in CI.
 */
export interface TestInfra {
  databaseUrl: string
  natsUrl?: string
  stop(): Promise<void>
}

export async function startTestInfra(opts: { nats?: boolean } = {}): Promise<TestInfra> {
  if (process.env.DATABASE_URL)
    return { databaseUrl: process.env.DATABASE_URL, natsUrl: process.env.NATS_URL, stop: async () => {} }
  const pg: StartedPostgreSqlContainer = await new PostgreSqlContainer('pgvector/pgvector:pg18')
    .withDatabase('kern_test')
    .withUsername('kern')
    .withPassword('kern')
    .start()
  let nats: StartedTestContainer | undefined
  if (opts.nats)
    nats = await new GenericContainer('nats:2.11-alpine').withCommand(['-js']).withExposedPorts(4222).start()
  return {
    databaseUrl: pg.getConnectionUri(),
    natsUrl: nats ? `nats://${nats.getHost()}:${nats.getMappedPort(4222)}` : undefined,
    async stop() {
      await nats?.stop()
      await pg.stop()
    },
  }
}

/** Create an isolated database on an existing server (e.g. the dev Postgres) and return its URL. */
export async function createScratchDatabase(
  baseUrl: string,
  name = `kern_test_${Date.now().toString(36)}`,
): Promise<{ url: string; drop(): Promise<void> }> {
  const { default: pg } = await import('pg')
  const admin = new pg.Client({ connectionString: baseUrl })
  await admin.connect()
  await admin.query(`create database "${name}"`)
  const url = new URL(baseUrl)
  url.pathname = `/${name}`
  const client = new pg.Client({ connectionString: url.toString() })
  await client.connect()
  for (const ext of ['vector', 'pg_trgm', 'ltree', 'pgcrypto'])
    await client.query(`create extension if not exists ${ext}`).catch(() => {})
  await client.end()
  return {
    url: url.toString(),
    async drop() {
      await admin.query(`drop database if exists "${name}" with (force)`)
      await admin.end()
    },
  }
}

export * from './permission-matrix.js'
