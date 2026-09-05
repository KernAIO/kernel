/**
 * An unset variable in a shipped compose file arrives as the empty string, not as absent.
 *
 * All three stacks pass every kernel variable through unconditionally — `S3_ENDPOINT:
 * ${S3_ENDPOINT}`, `KERN_BASE_URL: ${KERN_BASE_URL}` — and `.env.example` ships several of them
 * blank, so zod had a *value* to validate. `''` is "Invalid URL", not a missing key, so `loadEnv`
 * threw before the service bound its port; and every service in an instance loads this schema, so
 * it is the whole instance rather than one feature. The quieter half is worse: a `.default()` only
 * fires for `undefined`, so `S3_REGION: ''` signed against no region and `Number('')` made
 * `DATABASE_POOL_MAX: ''` a pool of zero.
 *
 * So the rule is the whole object at once, and this walks the whole object to prove it: every key
 * the schema declares, blank, must parse. A field added later is covered without anybody
 * remembering to come back here.
 */
import { describe, expect, it } from 'vitest'
import { KernelEnv, KernelEnvFields, loadEnv } from './config.js'

const KEYS = Object.keys(KernelEnvFields.shape)
const blank = (value: string) => Object.fromEntries(KEYS.map((k) => [k, value]))

/** The only two an instance must actually set: everything else has a default or is optional. */
const REQUIRED = ['KERN_SECRET', 'DATABASE_URL']
const supplied = {
  KERN_SECRET: 'x'.repeat(32),
  DATABASE_URL: 'postgres://kern_app:pw@postgres:5432/kern',
}
const issuesOf = (input: Record<string, unknown>) => {
  const parsed = KernelEnv.safeParse(input)
  return parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
}

describe('kernel environment', () => {
  it('declares the keys the shipped compose files pass', () => {
    // Named so a rename is visible here rather than only on somebody's server.
    for (const key of [
      'NODE_ENV',
      'KERN_BASE_URL',
      'KERN_SECRET',
      'DATABASE_URL',
      'NATS_URL',
      'VALKEY_URL',
      'S3_ENDPOINT',
      'S3_PUBLIC_ENDPOINT',
      'S3_REGION',
      'S3_BUCKET',
      'S3_ACCESS_KEY',
      'S3_SECRET_KEY',
      'CORE_URL',
      'CHAT_URL',
      'MAIL_URL',
      'COLLAB_URL',
      'PORT',
    ])
      expect(KEYS).toContain(key)
  })

  it('treats an empty value as unset, for every key it has', () => {
    expect(issuesOf({ ...blank(''), ...supplied }), 'a blank environment must load').toEqual([])
  })

  it('treats a whitespace-only value as unset too', () => {
    expect(issuesOf({ ...blank('   '), ...supplied })).toEqual([])
  })

  it('asks for exactly the variables an instance has to set', () => {
    // A key added without a default or `.optional()` shows up here, where it is a decision rather
    // than a surprise on somebody's first boot.
    const missing = issuesOf(blank('')).map((i) => i.split(':')[0])
    expect(missing.sort()).toEqual([...REQUIRED].sort())
  })

  it('applies defaults rather than keeping the empty string', () => {
    const env = KernelEnv.parse({ ...blank(''), ...supplied })
    expect(env.NODE_ENV).toBe('development')
    expect(env.KERN_BASE_URL).toBe('http://localhost:5173')
    expect(env.KERN_VERSION).toBe('0.0.0-dev')
    expect(env.S3_REGION).toBe('us-east-1')
    expect(env.S3_BUCKET).toBe('kern')
    expect(env.CORE_URL).toBe('http://localhost:4000')
    // `Number('')` is 0, so every one of these loaded fine and was wrong.
    expect(env.PORT).toBe(4000)
    expect(env.DATABASE_POOL_MAX).toBe(20)
    expect(env.DATABASE_STATEMENT_TIMEOUT_MS).toBe(30_000)
    expect(env.DATABASE_IDLE_TX_TIMEOUT_MS).toBe(60_000)
    expect(env.DATABASE_LOCK_TIMEOUT_MS).toBe(10_000)
    expect(env.S3_FORCE_PATH_STYLE).toBe(true)
  })

  it('leaves an optional key undefined rather than empty', () => {
    const env = KernelEnv.parse({ ...blank(''), ...supplied })
    expect(env.S3_ENDPOINT).toBeUndefined()
    expect(env.S3_PUBLIC_ENDPOINT).toBeUndefined()
    expect(env.S3_ACCESS_KEY).toBeUndefined()
    expect(env.S3_SECRET_KEY).toBeUndefined()
    expect(env.NATS_URL).toBeUndefined()
    expect(env.VALKEY_URL).toBeUndefined()
    expect(env.LOG_LEVEL).toBeUndefined()
    expect(env.CORS_ORIGINS).toBeUndefined()
    expect(env.TRUSTED_PROXIES).toBeUndefined()
  })

  it('loads a process environment whose optional keys are all empty', () => {
    const env = loadEnv({ ...blank(''), ...supplied })
    expect(env.S3_ENDPOINT).toBeUndefined()
    expect(env.KERN_BASE_URL).toBe('http://localhost:5173')
  })

  it('still validates a value that is actually there', () => {
    const base = { ...blank(''), ...supplied }
    expect(KernelEnv.safeParse({ ...base, KERN_BASE_URL: 'https://kern.example.com' }).success).toBe(true)
    expect(KernelEnv.safeParse({ ...base, KERN_BASE_URL: 'nonsense' }).success).toBe(false)
    expect(KernelEnv.safeParse({ ...base, S3_ENDPOINT: 'http://minio:9000' }).success).toBe(true)
    expect(KernelEnv.safeParse({ ...base, S3_ENDPOINT: 'minio 9000' }).success).toBe(false)
    expect(KernelEnv.safeParse({ ...base, PORT: 'abc' }).success).toBe(false)
    expect(KernelEnv.safeParse({ ...base, NODE_ENV: 'staging' }).success).toBe(false)
    expect(KernelEnv.safeParse({ ...base, KERN_SECRET: 'short' }).success).toBe(false)
    expect(() => loadEnv({ ...base, DATABASE_URL: 'not-a-url' })).toThrow(/DATABASE_URL/)
  })
})
