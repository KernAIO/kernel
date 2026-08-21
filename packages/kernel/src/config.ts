import { z } from 'zod'

/** Environment shared by every Kern backend service. */
export const KernelEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  HOST: z.string().default('0.0.0.0'),
  KERN_BASE_URL: z.string().url().default('http://localhost:5173'),
  /** 32+ byte secret used to derive encryption keys for secrets at rest and service tokens */
  KERN_SECRET: z.string().min(32),
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MAX: z.coerce.number().int().default(20),
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
