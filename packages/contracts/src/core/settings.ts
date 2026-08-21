import { z } from 'zod'
import { Email } from '../common.js'

/** Instance-level settings (admin console). */
export const InstanceSettings = z.object({
  name: z.string().default('Kern'),
  baseUrl: z.string().url(),
  allowSignup: z.boolean().default(true),
  allowWorkspaceCreation: z.enum(['everyone', 'admins']).default('everyone'),
  defaultLocale: z.enum(['en', 'fa', 'ar', 'de']).default('en'),
  mailFrom: z.string().nullable().default(null),
  supportEmail: Email.nullable().default(null),
})
export type InstanceSettings = z.infer<typeof InstanceSettings>

/** Outbound mail provider config stored per workspace (secrets encrypted at rest). */
export const MailProviderConfig = z.discriminatedUnion('provider', [
  z.object({ provider: z.literal('platform') }),
  z.object({
    provider: z.literal('smtp'),
    host: z.string(),
    port: z.number().int(),
    secure: z.boolean().default(true),
    user: z.string().optional(),
    pass: z.string().optional(),
    from: z.string(),
  }),
  z.object({
    provider: z.literal('mailgun'),
    apiKey: z.string(),
    domain: z.string(),
    region: z.enum(['us', 'eu']).default('us'),
    from: z.string(),
  }),
  z.object({
    provider: z.literal('ses'),
    accessKeyId: z.string(),
    secretAccessKey: z.string(),
    region: z.string(),
    from: z.string(),
  }),
  z.object({ provider: z.literal('postmark'), serverToken: z.string(), from: z.string() }),
  z.object({ provider: z.literal('resend'), apiKey: z.string(), from: z.string() }),
])
export type MailProviderConfig = z.infer<typeof MailProviderConfig>

export const AiProviderConfig = z.object({
  provider: z.enum(['openai', 'anthropic', 'openai_compatible', 'ollama']),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  model: z.string(),
  embeddingModel: z.string().optional(),
  enabled: z.boolean().default(true),
})
export type AiProviderConfig = z.infer<typeof AiProviderConfig>
