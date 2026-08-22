import type { Principal } from '@kernaio/contracts'
import type { z } from 'zod'
import type { ProcedureBroker } from './call.js'

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
