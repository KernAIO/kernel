import type { ErrorCode } from '@kernalo/contracts'

export class KernError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly reason?: string,
  ) {
    super(message)
    this.name = 'KernError'
  }
  static notFound(what = 'Resource', reason?: string) { return new KernError('NOT_FOUND', `${what} not found`, undefined, reason) }
  static forbidden(permission?: string) { return new KernError('FORBIDDEN', 'Forbidden', permission ? { permission } : undefined) }
  static unauthorized() { return new KernError('UNAUTHORIZED', 'Unauthorized') }
  static badRequest(message: string, details?: Record<string, unknown>) { return new KernError('BAD_REQUEST', message, details) }
  static conflict(message: string, reason?: string) { return new KernError('CONFLICT', message, undefined, reason) }
  static moduleDisabled(module: string) { return new KernError('MODULE_DISABLED', `Module ${module} is disabled in this workspace`, { module }) }
}
export const httpStatusFor = (code: ErrorCode): number =>
  ({ BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, RATE_LIMITED: 429, VALIDATION: 422, MODULE_DISABLED: 403, INTERNAL: 500, UNAVAILABLE: 503 })[code]
