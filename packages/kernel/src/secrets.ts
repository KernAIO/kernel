import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

/**
 * AES-256-GCM envelope encryption for secrets at rest (SMTP passwords, API keys, IMAP creds).
 * Key derived from KERN_SECRET via HKDF with a purpose label so rotating a purpose doesn't affect others.
 * Format: `v1.<iv b64>.<tag b64>.<ciphertext b64>`
 */
export class Secrets {
  private readonly key: Buffer
  constructor(masterSecret: string, purpose = 'kern.secrets.v1') {
    this.key = Buffer.from(hkdfSync('sha256', masterSecret, 'kern', purpose, 32))
  }
  encrypt(plain: string, aad?: string): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    if (aad) cipher.setAAD(Buffer.from(aad))
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
    return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ct.toString('base64url')}`
  }
  decrypt(blob: string, aad?: string): string {
    const [v, iv, tag, ct] = blob.split('.')
    if (v !== 'v1' || !iv || !tag || !ct) throw new Error('bad secret blob')
    const d = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'))
    if (aad) d.setAAD(Buffer.from(aad))
    d.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8')
  }
  /** Encrypt string-valued leaves of an object marked in `secretKeys` (e.g. ['pass','apiKey']). */
  encryptFields<T extends Record<string, unknown>>(obj: T, secretKeys: string[], aad?: string): T {
    const out: Record<string, unknown> = { ...obj }
    for (const k of secretKeys)
      if (typeof out[k] === 'string' && !(out[k] as string).startsWith('v1.'))
        out[k] = this.encrypt(out[k] as string, aad)
    return out as T
  }
  decryptFields<T extends Record<string, unknown>>(obj: T, secretKeys: string[], aad?: string): T {
    const out: Record<string, unknown> = { ...obj }
    for (const k of secretKeys)
      if (typeof out[k] === 'string' && (out[k] as string).startsWith('v1.'))
        out[k] = this.decrypt(out[k] as string, aad)
    return out as T
  }
}
export const SECRET_FIELD_NAMES = [
  'pass',
  'password',
  'apiKey',
  'secretAccessKey',
  'serverToken',
  'clientSecret',
  'refreshToken',
  'accessToken',
  'token',
]
