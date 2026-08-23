import { z } from 'zod'
import { Timestamp } from '../common.js'
import { Id, UserId, WorkspaceId } from '../ids.js'

/**
 * The workspace dashboard: which cards somebody has on their home page, and how much of that a
 * workspace decides for them.
 *
 * The one thing worth knowing before reading the rest: **a preset's contents are not stored here.**
 * A preset is a list of widget ids, and a widget id is a client concept — the server has never heard
 * of `tracker.assigned-to-me`. So the server owns the policy and *which* preset applies, and the app
 * owns what that preset contains. `source: 'preset'` plus `presetId` is the whole handshake, and it
 * is what lets a preset be reshaped without a contracts-first publish.
 */

/** Which dashboard. A second one becomes another value here, not another table. */
export const DashboardSurface = z.literal('home')
export type DashboardSurface = z.infer<typeof DashboardSurface>

/**
 * How much of the layout a workspace decides.
 *
 * `locked` — everyone gets the workspace layout and cannot change it.
 * `default` — the workspace layout is where members start and what Reset returns to.
 * `open`    — everyone starts from a preset; the workspace layout is not consulted at all.
 */
export const DashboardPolicy = z.enum(['locked', 'default', 'open'])
export type DashboardPolicy = z.infer<typeof DashboardPolicy>

export const WidgetSizeKey = z.enum(['s', 'm', 'l', 'xl'])
export type WidgetSizeKey = z.infer<typeof WidgetSizeKey>

/** A widget id is `<module>.<widget>`, the same shape rule permissions and events follow. */
export const WidgetId = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)?$/)

export const PresetId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9-]*$/)

/** Settings are JSON-safe because they round-trip through a jsonb column. */
export const WidgetSettingsValue = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
)

/** One placed card. Geometry is in grid units on a twelve-column grid, never pixels. */
export const DashboardItem = z.object({
  /** the placed instance, unique within one layout */
  i: Id,
  widget: WidgetId,
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0).max(200),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(12),
  size: WidgetSizeKey,
  settings: WidgetSettingsValue.default({}),
})
export type DashboardItem = z.infer<typeof DashboardItem>

/** Forty is not a design limit, it is a bound on what one jsonb row is allowed to grow to. */
export const DashboardItems = z.array(DashboardItem).max(40)

export const DashboardLayout = z.object({
  workspaceId: WorkspaceId,
  surface: DashboardSurface,
  /** null on the layout the workspace hands out */
  userId: UserId.nullable(),
  items: DashboardItems,
  presetId: PresetId.nullable(),
  updatedAt: Timestamp.nullable(),
})
export type DashboardLayout = z.infer<typeof DashboardLayout>

/**
 * What to draw, already resolved through the policy, so the client never re-implements the table.
 *
 * When `source` is `preset` the layout's `items` are empty and `presetId` names what to expand — see
 * the note at the top of this file.
 */
export const DashboardView = z.object({
  policy: DashboardPolicy,
  defaultPresetId: PresetId,
  layout: DashboardLayout,
  source: z.enum(['personal', 'workspace', 'preset']),
  /** false under `locked`; the server refuses the write regardless */
  canCustomise: z.boolean(),
})
export type DashboardView = z.infer<typeof DashboardView>

export const DashboardSettings = z.object({
  policy: DashboardPolicy,
  defaultPresetId: PresetId,
  /** what members start from under `locked` and `default`; null until an owner sets one */
  workspace: DashboardLayout.nullable(),
})
export type DashboardSettings = z.infer<typeof DashboardSettings>
