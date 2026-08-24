import { type CapabilityDef, type CapabilityId, type Principal, resolveCapabilities } from '@kernhq/contracts'
import type { z } from 'zod'
import type { ProcedureBroker } from './call.js'

/**
 * Reserved key inside a module's settings jsonb where its capability switches live.
 *
 * Capabilities are the platform's, not the module's: the module declares which exist, the workspace
 * decides which are on, and the module's own `settings` zod schema never mentions them. Storing them
 * under a `$`-prefixed key keeps them out of that schema's way — a module cannot declare a settings
 * field of this name, and a settings round-trip cannot drop them.
 */
export const CAPABILITIES_KEY = '$capabilities'

/**
 * Typed access to workspace-level module settings and instance settings.
 * Storage lives in core (`core.settings.*` procedures); other services read through the broker with a short cache.
 */
export class Settings {
  private readonly cache = new Map<string, { v: unknown; exp: number }>()
  constructor(
    private readonly broker: ProcedureBroker,
    private readonly system: Principal,
    private readonly ttlMs = 15_000,
  ) {}

  async module<T extends z.ZodTypeAny>(
    workspaceId: string,
    moduleId: string,
    schema: T,
  ): Promise<z.infer<T>> {
    const key = `m:${workspaceId}:${moduleId}`
    const hit = this.cache.get(key)
    if (hit && hit.exp > Date.now()) return hit.v as z.infer<T>
    const raw = await this.broker.call<Record<string, unknown>>(
      'core.settings.getModule',
      { workspaceId, moduleId },
      this.system,
    )
    const v = schema.parse(raw ?? {})
    this.cache.set(key, { v, exp: Date.now() + this.ttlMs })
    return v
  }
  async setModule(workspaceId: string, moduleId: string, settings: Record<string, unknown>) {
    await this.broker.call('core.settings.setModule', { workspaceId, moduleId, settings }, this.system)
    this.cache.delete(`m:${workspaceId}:${moduleId}`)
  }
  /** Encrypted integration config per workspace (smtp, ai, livekit, imap accounts…) */
  async integration<T>(workspaceId: string, kind: string): Promise<T | null> {
    return this.broker.call<T | null>('core.settings.getIntegration', { workspaceId, kind }, this.system)
  }
  async setIntegration(workspaceId: string, kind: string, config: Record<string, unknown> | null) {
    await this.broker.call('core.settings.setIntegration', { workspaceId, kind, config }, this.system)
  }
  /**
   * Which of a module's capabilities are on for this workspace, resolved.
   *
   * Resolved, not raw: defaults filled in, `required` forced on, and anything whose dependency is
   * off pruned. This is the single answer both halves use — `requiresCapability` on the server and
   * the shell's navigation filter on the client — because two implementations of the closure would
   * eventually disagree, and the way that shows up is a menu item that 404s.
   */
  async capabilities(
    workspaceId: string,
    moduleId: string,
    defs: readonly CapabilityDef[],
  ): Promise<Set<CapabilityId>> {
    if (!defs.length) return new Set()
    const raw = await this.moduleRaw(workspaceId, moduleId)
    const stored = raw[CAPABILITIES_KEY]
    return resolveCapabilities(
      defs,
      typeof stored === 'object' && stored !== null ? (stored as Record<string, boolean>) : null,
    )
  }

  /** The stored settings record, unparsed. Same cache as `module()`. */
  async moduleRaw(workspaceId: string, moduleId: string): Promise<Record<string, unknown>> {
    const key = `r:${workspaceId}:${moduleId}`
    const hit = this.cache.get(key)
    if (hit && hit.exp > Date.now()) return hit.v as Record<string, unknown>
    const raw =
      (await this.broker.call<Record<string, unknown>>(
        'core.settings.getModule',
        { workspaceId, moduleId },
        this.system,
      )) ?? {}
    this.cache.set(key, { v: raw, exp: Date.now() + this.ttlMs })
    return raw
  }

  async isModuleEnabled(workspaceId: string, moduleId: string): Promise<boolean> {
    const key = `e:${workspaceId}:${moduleId}`
    const hit = this.cache.get(key)
    if (hit && hit.exp > Date.now()) return hit.v as boolean
    const v = await this.broker.call<boolean>(
      'core.modules.isEnabled',
      { workspaceId, moduleId },
      this.system,
    )
    this.cache.set(key, { v, exp: Date.now() + this.ttlMs })
    return v
  }
  invalidate(workspaceId: string, moduleId?: string) {
    for (const k of this.cache.keys())
      if (k.includes(`:${workspaceId}:`) && (!moduleId || k.endsWith(`:${moduleId}`))) this.cache.delete(k)
  }
}
