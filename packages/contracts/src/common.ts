import { z } from 'zod'

// ---------- errors ----------
export const ErrorCode = z.enum([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'VALIDATION',
  'MODULE_DISABLED',
  'INTERNAL',
  'UNAVAILABLE',
])
export type ErrorCode = z.infer<typeof ErrorCode>

export const ApiError = z.object({
  code: ErrorCode,
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  /** stable, i18n-able identifier, e.g. `tracker.issue.key_taken` */
  reason: z.string().optional(),
})
export type ApiError = z.infer<typeof ApiError>

// ---------- pagination ----------
export const Cursor = z.string().min(1).max(512)
export const PageInput = z.object({
  cursor: Cursor.optional(),
  limit: z.number().int().min(1).max(200).default(50),
})
export type PageInput = z.infer<typeof PageInput>

export const page = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: Cursor.nullable(),
    total: z.number().int().nonnegative().optional(),
  })
export type Page<T> = { items: T[]; nextCursor: string | null; total?: number }

// ---------- misc scalars ----------
export const Timestamp = z.iso.datetime({ offset: true })
export type Timestamp = z.infer<typeof Timestamp>
export const Locale = z.enum(['en', 'fa', 'ar', 'de'])
export type Locale = z.infer<typeof Locale>
export const Email = z
  .email()
  .max(254)
  .transform((s) => s.trim().toLowerCase())
export const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/)
export const Json = z.json()
export type Json = z.infer<typeof Json>

export const Sort = z.object({ field: z.string(), dir: z.enum(['asc', 'desc']).default('asc') })
export type Sort = z.infer<typeof Sort>
