import type { ServerModule } from './module.js'

export class ModuleRegistry {
  private readonly modules = new Map<string, ServerModule>()
  constructor(modules: ServerModule[] = []) {
    for (const m of modules) this.register(m)
  }
  register(mod: ServerModule) {
    const id = mod.definition.id
    if (this.modules.has(id)) throw new Error(`Module already registered: ${id}`)
    this.modules.set(id, mod)
  }
  get(id: string): ServerModule | undefined {
    return this.modules.get(id)
  }
  has(id: string) {
    return this.modules.has(id)
  }
  all(): ServerModule[] {
    return this.sorted()
  }
  ids(): string[] {
    return this.sorted().map((m) => m.definition.id)
  }
  /** topologically sorted by dependsOn (deps first) */
  private sorted(): ServerModule[] {
    const out: ServerModule[] = []
    const seen = new Set<string>()
    const visit = (id: string, stack: string[]) => {
      if (seen.has(id)) return
      if (stack.includes(id)) throw new Error(`Module dependency cycle: ${[...stack, id].join(' -> ')}`)
      const mod = this.modules.get(id)
      if (!mod) return // dependency hosted by another service; fine
      for (const dep of mod.definition.dependsOn ?? []) visit(dep, [...stack, id])
      seen.add(id)
      out.push(mod)
    }
    for (const id of this.modules.keys()) visit(id, [])
    return out
  }
  permissions() {
    return this.all().flatMap((m) =>
      (m.definition.permissions ?? []).map((p) => ({ ...p, module: m.definition.id })),
    )
  }
  /** A module's declared capabilities, or none — an unknown module and one that declares none look alike on purpose. */
  capabilities(moduleId: string) {
    return this.modules.get(moduleId)?.definition.capabilities ?? []
  }
  notificationTypes() {
    return this.all().flatMap((m) =>
      (m.definition.notificationTypes ?? []).map((t) => ({ ...t, module: m.definition.id })),
    )
  }
}
