import { z } from 'zod'

/** Environment shared by every Kern backend service. */
export const KernelEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  HOST: z.string().default('0.0.0.0'),
  KERN_BASE_URL: z.string().url().default('http://localhost:5173'),
  /** 32+ byte secret used to derive encryption keys for secrets at rest and service tokens */
  KERN_SECRET: z.string().min(32),
  /**
   * The release this process belongs to. Baked into the image at build time; every service in an
   * instance runs the same one, which is what makes "the version of Kern you run" a single answer.
   * `0.0.0-dev` outside a released image.
   */
  KERN_VERSION: z.string().default('0.0.0-dev'),
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MAX: z.coerce.number().int().default(20),
  /**
   * Per-connection query-cost bounds, in milliseconds. `0` disables one.
   *
   * Every tenant shares one pool, so a single pathological query — a saved view with no bound, a
   * report over a table that grew — holds a connection for as long as Postgres will let it, and the
   * pool runs out for everybody else. These are the only thing that puts a ceiling on that, and
   * Postgres has no useful default for any of them.
   *
   * They are sent in the startup packet, so they apply to the request pool only: migrations run on
   * their own connections with all three off, because an index build on a large table is exactly the
   * long statement `statement_timeout` exists to kill, and killing it fails the boot.
   */
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(0).default(30_000),
  DATABASE_IDLE_TX_TIMEOUT_MS: z.coerce.number().int().min(0).default(60_000),
  DATABASE_LOCK_TIMEOUT_MS: z.coerce.number().int().min(0).default(10_000),
  NATS_URL: z.string().optional(),
  VALKEY_URL: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_PUBLIC_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('kern'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  /** URL of the core service (JWKS, internal calls) */
  CORE_URL: z.string().url().default('http://localhost:4000'),
  CHAT_URL: z.string().url().default('http://localhost:4100'),
  MAIL_URL: z.string().url().default('http://localhost:4200'),
  COLLAB_URL: z.string().url().default('http://localhost:4300'),
  LOG_LEVEL: z.string().optional(),
  /** comma-separated allowed browser origins (defaults to KERN_BASE_URL) */
  CORS_ORIGINS: z.string().optional(),
  /**
   * Which peers may set `X-Forwarded-For`, and therefore decide what `req.ip` is.
   *
   * A comma-separated list of addresses, CIDRs, or the named ranges `loopback`, `uniquelocal` and
   * `linklocal`. Empty means those three — Caddy sits on a private network in all three shipped
   * topologies — so a request arriving straight from a public address is not believed whatever
   * header it carries. `none` trusts nothing, for a service with no proxy in front of it.
   *
   * It used to be `trustProxy: true`, which trusts *every* hop: `req.ip` was whatever the client
   * claimed, so the per-IP rate limit was keyed on a value the caller picked. Nothing may decide
   * access on `req.ip` even now; this only makes it honest enough to count with. See
   * `trustProxyFrom` for why a bare hop count is not one of the accepted forms.
   */
  TRUSTED_PROXIES: z.string().optional(),
})
export type KernelEnv = z.infer<typeof KernelEnv>

export function loadEnv(extra: Record<string, string | undefined> = {}): KernelEnv {
  const parsed = KernelEnv.safeParse({ ...process.env, ...extra })
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid environment:\n${issues}`)
  }
  return parsed.data
}
