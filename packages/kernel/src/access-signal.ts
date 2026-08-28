/**
 * The trace an operator leaves when they reach into a workspace they do not belong to.
 *
 * `workspaceScoped` skips the membership check for an instance admin and for a service principal,
 * and both are right: an admin has to be able to fix a tenant's workspace, and a service call has no
 * membership to have. What was wrong is that it happened silently — support opening a customer's
 * data looked exactly like the customer opening it, and nothing anywhere recorded that it had.
 *
 * Two rules shape this:
 *
 * - **It must not slow the request down.** Sinks are called synchronously and their promises are not
 *   awaited; a slow sink delays nothing.
 * - **It must not be able to fail the request.** A sink that throws — or a bus that is down — is
 *   logged and swallowed. An audit trail that can take the service with it is worse than no audit
 *   trail, because it turns every observation into an outage.
 *
 * The kernel installs a sink that publishes `kernel.access.crossed` on the event bus, which is how
 * `core` learns about a request that happened in `chat`. Anything else may add its own with `on()`.
 */
import { defineEvent } from '@kernhq/contracts'
import { z } from 'zod'
import type { Logger } from './logger.js'

/** What was crossed, by whom. One record per procedure call, not per session. */
export const UnscopedAccess = z.object({
  /** the workspace whose data was reached */
  workspaceId: z.string(),
  /** the oRPC procedure path, e.g. `hr.people.get` */
  procedure: z.string(),
  /** why the membership check was skipped */
  via: z.enum(['instance_admin', 'service']),
  principal: z.object({
    kind: z.string(),
    userId: z.string().nullable(),
    email: z.string().nullable(),
    /** the service name when this was a service-to-service call */
    service: z.string().nullable(),
  }),
  /** the request id already on every response as `x-request-id`, so a log line can be found again */
  requestId: z.string(),
  /** as reported by the proxy — a claim, never evidence. Recorded for correlation only. */
  ip: z.string(),
  at: z.string(),
})
export type UnscopedAccess = z.infer<typeof UnscopedAccess>

/**
 * Emitted whenever a principal passes `workspaceScoped` without a membership.
 *
 * `core` subscribes to it and writes the audit row; nothing else in the kernel reads it. It is a
 * signal, not a decision — the request has already been allowed by the time this is published.
 */
export const workspaceAccessCrossed = defineEvent('kernel.access.crossed', UnscopedAccess, {
  description: 'A principal reached a workspace it is not a member of (instance admin or service)',
})

export type UnscopedAccessSink = (access: UnscopedAccess) => void | Promise<void>

/** Fan-out with the two properties above: never awaited, never able to throw at the caller. */
export class UnscopedAccessSignal {
  private readonly sinks: UnscopedAccessSink[] = []
  constructor(private readonly log?: Logger) {}

  /** Add a sink. Returns a function that removes it again. */
  on(sink: UnscopedAccessSink): () => void {
    this.sinks.push(sink)
    return () => {
      const i = this.sinks.indexOf(sink)
      if (i >= 0) this.sinks.splice(i, 1)
    }
  }

  /** Record one crossing. Returns immediately; nothing here is on the request's critical path. */
  record(access: UnscopedAccess): void {
    for (const sink of this.sinks) {
      try {
        const r = sink(access)
        if (r && typeof (r as Promise<void>).catch === 'function')
          (r as Promise<void>).catch((err) => this.failed(err))
      } catch (err) {
        this.failed(err)
      }
    }
  }

  private failed(err: unknown) {
    this.log?.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'unscoped-access sink failed; the request was not affected',
    )
  }
}
