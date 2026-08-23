import { z } from 'zod'
import { Timestamp } from '../common.js'
import { ModuleId } from '../ids.js'

/**
 * Kern is released as one platform: every service image and every module carries the same
 * `KERN_VERSION`, and an upgrade moves all of them together. A release therefore describes both
 * the images it publishes and the module versions inside them, so an admin can see what a version
 * bump actually changes without reading a changelog for each module.
 */

/**
 * How much of the schema a release touches. This is what decides whether rolling an image back is
 * enough on its own, or whether the database has to be restored with it.
 */
export const SchemaChangeLevel = z.enum(['none', 'additive', 'breaking'])
export type SchemaChangeLevel = z.infer<typeof SchemaChangeLevel>

export const ReleaseEntry = z.object({
  /** the `KERN_VERSION` tag, without a leading `v` */
  version: z.string(),
  channel: z.literal('stable'),
  publishedAt: Timestamp,
  notesUrl: z.string().url().nullable().default(null),
  /** image tag per service, keyed by service name */
  services: z.record(z.string(), z.string()).default({}),
  /** module id → version shipped in this release */
  modules: z.record(z.string(), z.string()).default({}),
  /**
   * Oldest version that may upgrade straight to this one. An instance further back has to step
   * through an intermediate release rather than skip migrations that later ones assume.
   */
  minPreviousVersion: z.string().nullable().default(null),
  schemaChanges: SchemaChangeLevel.default('additive'),
  /** environment variables this release requires that earlier ones did not */
  requiredEnv: z.array(z.string()).default([]),
})
export type ReleaseEntry = z.infer<typeof ReleaseEntry>

/** The signed document an instance fetches. `signature` covers the canonical JSON of `releases`. */
export const ReleaseFeed = z.object({
  schema: z.literal(1),
  generatedAt: Timestamp,
  releases: z.array(ReleaseEntry),
})
export type ReleaseFeed = z.infer<typeof ReleaseFeed>

export const ModuleVersionChange = z.object({
  moduleId: ModuleId,
  from: z.string().nullable(),
  to: z.string().nullable(),
  kind: z.enum(['added', 'changed', 'removed', 'unchanged']),
})
export type ModuleVersionChange = z.infer<typeof ModuleVersionChange>

/** A reason the instance cannot take this release yet. The admin has to act before upgrading. */
export const UpdateBlocker = z.object({
  code: z.enum(['version_skip', 'missing_env', 'unverified_signature', 'unknown_current_version']),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
})
export type UpdateBlocker = z.infer<typeof UpdateBlocker>

/**
 * What this instance does about a new release.
 *
 * There is one policy, not one per module: a release moves every service image and every module
 * together, so "update the tracker but not chat" is not a state an instance can be in.
 */
export const UpdateMode = z.enum([
  /** do not even look — for an air-gapped instance, or one somebody else manages */
  'off',
  /** look, and tell an instance admin; a person applies it */
  'notify',
  /** look, and apply it inside the window without being asked */
  'auto',
])
export type UpdateMode = z.infer<typeof UpdateMode>

/** `HH:MM`, 24-hour. */
const ClockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM, 24-hour')

export const UpdatePolicy = z.object({
  mode: UpdateMode.default('notify'),
  /**
   * When an automatic upgrade may start. It is a window rather than a time because an upgrade takes
   * minutes, and because an instance that missed its moment should get another one tonight.
   */
  window: z.object({ start: ClockTime, end: ClockTime }).default({ start: '03:00', end: '05:00' }),
  /** IANA zone the window is read in. Without it "03:00" means 03:00 somewhere nobody lives. */
  timezone: z.string().default('UTC'),
  /**
   * How long a release must have been out before this instance takes it on its own. Nobody wants to
   * be the instance that finds the problem with a release on the day it ships.
   */
  minReleaseAgeHours: z.number().int().min(0).max(720).default(72),
})
export type UpdatePolicy = z.infer<typeof UpdatePolicy>

/** The outcome of the last upgrade this instance applied to itself. */
export const AutoUpdateAttempt = z.object({
  version: z.string(),
  at: Timestamp,
  ok: z.boolean(),
  error: z.string().nullable().default(null),
})
export type AutoUpdateAttempt = z.infer<typeof AutoUpdateAttempt>

/**
 * The answer the thing on the host asks for before it upgrades anything: may I, and to what. It is
 * computed here rather than in the shell script so that what the panel promises and what actually
 * happens cannot disagree.
 */
export const UpdatePlan = z.object({
  shouldUpgrade: z.boolean(),
  version: z.string().nullable(),
  /** why not, in words an admin reads in a log at 04:00 */
  reason: z.string(),
  policy: UpdatePolicy,
})
export type UpdatePlan = z.infer<typeof UpdatePlan>

export const UpdateStatus = z.object({
  policy: UpdatePolicy,
  /** the last automatic attempt, whether it worked or not */
  lastAttempt: AutoUpdateAttempt.nullable(),
  /** when an automatic upgrade could next start; null unless the mode is `auto` */
  nextAttemptAt: Timestamp.nullable(),
  /** what an automatic upgrade would do right now, and why it would or would not */
  plan: UpdatePlan.nullable(),
  /** when the feed was last read; null when the check has never run or is switched off */
  checkedAt: Timestamp.nullable(),
  /** why the last check failed, if it did — shown instead of pretending the instance is current */
  lastError: z.string().nullable(),
  current: z.object({
    version: z.string(),
    modules: z.array(z.object({ id: ModuleId, version: z.string() })),
  }),
  latest: ReleaseEntry.nullable(),
  updateAvailable: z.boolean(),
  moduleChanges: z.array(ModuleVersionChange).default([]),
  blockers: z.array(UpdateBlocker).default([]),
  /** the command an admin runs to apply it; null when there is nothing to apply */
  command: z.string().nullable(),
})
export type UpdateStatus = z.infer<typeof UpdateStatus>
