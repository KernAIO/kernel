import { createSecretKey } from 'node:crypto'
import { ANONYMOUS, type MembershipSummary, type Principal } from '@kernalo/contracts'
import { createRemoteJWKSet, type JWTPayload, jwtVerify, SignJWT } from 'jose'

/**
 * Principal resolution for non-core services: verify a Kern JWT (issued by core / Better Auth jwt plugin)
 * against core's JWKS, then load memberships via `core.users.principal` (cached by the caller).
 */
export interface AuthVerifier {
  verify(token: string): Promise<JWTPayload | null>
  /** service→service token (HS256 with KERN_SECRET) */
  signService(service: string, ttlSec?: number): Promise<string>
  verifyService(token: string): Promise<string | null>
}
export function createAuthVerifier(opts: {
  coreUrl: string
  kernSecret: string
  issuer?: string
}): AuthVerifier {
  const jwks = createRemoteJWKSet(new URL('/api/auth/jwks', opts.coreUrl))
  const hs = createSecretKey(Buffer.from(opts.kernSecret))
  return {
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, jwks, { issuer: opts.issuer })
        return payload
      } catch {
        return null
      }
    },
    async signService(service, ttlSec = 300) {
      return new SignJWT({ svc: service })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setIssuer('kern-internal')
        .setExpirationTime(`${ttlSec}s`)
        .sign(hs)
    },
    async verifyService(token) {
      try {
        const { payload } = await jwtVerify(token, hs, { issuer: 'kern-internal' })
        return (payload as any).svc ?? null
      } catch {
        return null
      }
    },
  }
}

export const systemPrincipal = (service: string): Principal => ({
  ...ANONYMOUS,
  kind: 'service',
  service,
  instanceAdmin: true,
  name: `service:${service}`,
})
export function principalFromClaims(
  p: JWTPayload & Record<string, unknown>,
  memberships: MembershipSummary[] = [],
): Principal {
  return {
    kind: p.akid ? 'api_key' : 'user',
    userId: p.sub as Principal['userId'],
    email: (p.email as string) ?? null,
    name: (p.name as string) ?? null,
    locale: (p.locale as Principal['locale']) ?? 'en',
    instanceAdmin: Boolean(p.adm),
    service: null,
    memberships,
    permissionVersion: Number(p.pv ?? 0),
  }
}
