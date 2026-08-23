import type { Principal } from '@kernhq/contracts'
import type { ProcedureBroker } from './call.js'
import { KernError } from './errors.js'

/**
 * The procedure a billing module registers to answer "what is this workspace allowed to do".
 * Nothing in the kernel or in core imports that module — the name is the whole coupling, and
 * `broker.has()` is how we find out whether anybody is answering.
 */
export const ENTITLEMENTS_PROCEDURE = 'billing.entitlements.get'

/**
 * The limits a plan can set.
 *
 * The **values** are data: a plan row in whichever module is doing the billing decides them, and an
 * instance admin edits that row. The **keys** are not data, and deliberately so — every key here has
 * exactly one place in the codebase that enforces it, and adding a key without adding that place
 * produces a plan that promises something nobody checks. That is how a pricing page starts lying.
 *
 * `null` always means unlimited.
 */
export interface Entitlement {
  /** billable seats; guests do not consume one */
  seats: number | null
  /** total bytes of stored files */
  storageBytes: number | null
  /** module ids this plan allows to be enabled; `null` = every module the instance ships */
  modules: string[] | null
  /** sign-in through an external identity provider (OIDC/SAML) */
  sso: boolean
  /** how long audit entries are kept before the prune job removes them */
  auditRetentionDays: number | null
  /** requests per minute against the public API */
  apiRateLimit: number | null
  /** the plan this came from, so an error can say which one — `null` when nothing is billing */
  planName: string | null
  /**
   * False while a subscription is past due or suspended. Reads still work; writes are refused.
   * Suspension withholds the service, it never deletes the customer's data.
   */
  active: boolean
}

/** What every workspace gets when no module is answering — i.e. every self-hosted instance. */
export const UNLIMITED: Entitlement = Object.freeze({
  seats: null,
  storageBytes: null,
  modules: null,
  sso: true,
  auditRetentionDays: null,
  apiRateLimit: null,
  planName: null,
  active: true,
})

/** Keys whose limit is a number, and which therefore can be compared against a wanted total. */
export type CountedKey = 'seats' | 'storageBytes' | 'auditRetentionDays' | 'apiRateLimit'

const REASON: Record<CountedKey, string> = {
  seats: 'billing.seats.limit_reached',
  storageBytes: 'billing.storage.limit_reached',
  auditRetentionDays: 'billing.audit_retention.limit_reached',
  apiRateLimit: 'billing.api_rate.limit_reached',
}

/**
 * What a workspace is allowed to do, asked from the side that enforces rather than the side that
 * sells.
 *
 * Core hosts modules and so cannot import one; a billing module must therefore be something core
 * asks *through* the kernel, exactly the way `Settings` reaches core's own settings procedures from
 * services that do not contain them. When no module answers — no billing installed, or it is
 * switched off — every workspace is unlimited, and no caller needs to know the difference.
 */
export class Entitlements {
  private readonly cache = new Map<string, { v: Entitlement; exp: number }>()
  constructor(
    private readonly broker: ProcedureBroker,
    private readonly system: Principal,
    private readonly ttlMs = 30_000,
  ) {}

  /** The resolved limits for a workspace. Never throws: an unreachable biller means unlimited. */
  async of(workspaceId: string): Promise<Entitlement> {
    if (!this.broker.has(ENTITLEMENTS_PROCEDURE)) return UNLIMITED
    const hit = this.cache.get(workspaceId)
    if (hit && hit.exp > Date.now()) return hit.v
    const raw = await this.broker.call<Partial<Entitlement> | null>(
      ENTITLEMENTS_PROCEDURE,
      { workspaceId },
      this.system,
    )
    const v: Entitlement = { ...UNLIMITED, ...(raw ?? {}) }
    this.cache.set(workspaceId, { v, exp: Date.now() + this.ttlMs })
    return v
  }

  /**
   * Refuse when `wanted` would exceed the limit.
   *
   * `wanted` is the **resulting total**, not the delta — inviting two people into a workspace of
   * three asks for five. Deltas read fine at the call site and go wrong the moment two of them race.
   */
  async require(workspaceId: string, key: CountedKey, wanted: number): Promise<void> {
    const ent = await this.of(workspaceId)
    const limit = ent[key]
    if (limit === null || wanted <= limit) return
    throw new KernError(
      'CONFLICT',
      `This workspace's plan includes ${limit} ${key === 'seats' ? 'seats' : key}`,
      { key, limit, wanted, plan: ent.planName },
      REASON[key],
    )
  }

  /** Whether the plan lets this module be switched on. */
  async allowsModule(workspaceId: string, moduleId: string): Promise<boolean> {
    const { modules } = await this.of(workspaceId)
    return modules === null || modules.includes(moduleId)
  }

  /** Whether a boolean feature is included. */
  async has(workspaceId: string, feature: 'sso'): Promise<boolean> {
    return (await this.of(workspaceId))[feature]
  }

  /**
   * Refuse a write while the subscription is past due or suspended.
   * Reads are deliberately not routed through this — a customer who stopped paying keeps being able
   * to read and export what is theirs.
   */
  async requireActive(workspaceId: string): Promise<void> {
    const ent = await this.of(workspaceId)
    if (ent.active) return
    throw new KernError(
      'CONFLICT',
      'This workspace is suspended because its subscription is not current',
      { plan: ent.planName },
      'billing.subscription.inactive',
    )
  }

  invalidate(workspaceId?: string) {
    if (workspaceId) this.cache.delete(workspaceId)
    else this.cache.clear()
  }
}
