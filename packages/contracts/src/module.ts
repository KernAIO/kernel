import { z } from 'zod'
import { ModuleId } from './ids.js'
import { PermissionDef } from './permissions.js'

/** JSON-serialisable module manifest (what the admin UI / CLI sees). */
export const ModuleManifest = z.object({
  id: ModuleId,
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  /** core modules are always enabled and cannot be disabled per workspace */
  core: z.boolean().default(false),
  dependsOn: z.array(ModuleId).default([]),
  /**
   * Semver range of the platform this module can run on. Modules are versioned and released
   * together, so first-party modules rarely need it — it exists for custom builds, where a module
   * package and the images around it can be moved independently and would otherwise fail at some
   * unrelated call site instead of at boot.
   */
  minKernel: z.string().optional(),
  permissions: z.array(PermissionDef).default([]),
  /** event names this module emits */
  events: z.array(z.string()).default([]),
  /** object types this module owns (for mentions/links/object channels) */
  objectTypes: z
    .array(
      z.object({
        type: z.string(),
        label: z.string(),
        icon: z.string().optional(),
        channelable: z.boolean().default(false),
      }),
    )
    .default([]),
  /** JSON schema of workspace-level settings (derived from zod) */
  settingsSchema: z.record(z.string(), z.unknown()).optional(),
  /** which service hosts the server part by default */
  defaultHost: z.string().default('core'),
  /** URL path prefix of its API: /api/<apiPrefix> (defaults to id) */
  apiPrefix: z.string().optional(),
})
export type ModuleManifest = z.infer<typeof ModuleManifest>

export const WorkspaceModuleState = z.object({
  moduleId: ModuleId,
  enabled: z.boolean(),
  settings: z.record(z.string(), z.unknown()).default({}),
  installedVersion: z.string().nullable(),
})
export type WorkspaceModuleState = z.infer<typeof WorkspaceModuleState>
