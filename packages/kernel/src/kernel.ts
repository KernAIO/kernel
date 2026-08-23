import type { EventDef, EventEnvelope, EventPayload, Principal } from '@kernhq/contracts'
import { Redis } from 'ioredis'
import type { NatsConnection } from 'nats'
import { type AuthVerifier, createAuthVerifier, systemPrincipal } from './auth.js'
import { Authz, type AuthzCache, type AuthzStore } from './authz.js'
import { ProcedureBroker } from './call.js'
import { type KernelEnv, loadEnv } from './config.js'
import { createDatabase, type Database } from './db.js'
import { Entitlements } from './entitlements.js'
import type { EventBus, PublishOptions } from './events/bus.js'
import { createEventBus, NatsEventBus } from './events/nats.js'
import { createJobs, type Jobs } from './jobs.js'
import { createLogger, type Logger } from './logger.js'
import { createMaintenance, type Maintenance } from './maintenance.js'
import type { ServerModule } from './module.js'
import { assertModulesSatisfyKernel, toManifest } from './module.js'
import { createRealtime, type Realtime } from './realtime.js'
import { ModuleRegistry } from './registry.js'
import { Secrets } from './secrets.js'
import { Settings } from './settings.js'
import { createStorage, type Storage } from './storage.js'

export interface KernelOptions {
  /** service name: core | chat | mail | collab | worker */
  service: string
  /** override the release reported by the kernel; production reads `KERN_VERSION` from the image */
  version?: string
  modules: ServerModule[]
  /** raw environment overrides, merged over `process.env` before validation (values are strings) */
  env?: Record<string, string | undefined>
  /** role of this process */
  role?: 'api' | 'worker' | 'both'
  /** core service provides a DB-backed store; others default to call-based */
  authzStore?: (k: Kernel) => AuthzStore
}

export interface Kernel {
  service: string
  version: string
  role: 'api' | 'worker' | 'both'
  env: KernelEnv
  log: Logger
  registry: ModuleRegistry
  database: Database
  events: EventBus
  broker: ProcedureBroker
  authz: Authz
  jobs: Jobs
  settings: Settings
  /** what a workspace's plan allows; unlimited when no billing module is answering */
  entitlements: Entitlements
  secrets: Secrets
  storage: Storage
  realtime: Realtime
  /** instance-wide "upgrading, come back in a moment" flag */
  maintenance: Maintenance
  auth: AuthVerifier
  redis: Redis | null
  nats: NatsConnection | undefined
  system: Principal
  /** publish a typed event (workspace/actor in opts) */
  emit<E extends EventDef>(def: E, payload: EventPayload<E>, opts?: PublishOptions): Promise<void>
  /** call `<module>.<procedure>` wherever it's hosted */
  call<T = unknown>(name: string, input: unknown, principal?: Principal): Promise<T>
  isModuleEnabled(workspaceId: string, moduleId: string): Promise<boolean>
  manifests(): ReturnType<typeof toManifest>[]
  start(): Promise<void>
  stop(): Promise<void>
}

export async function createKernel(opts: KernelOptions): Promise<Kernel> {
  const env = loadEnv(opts.env)
  const log = createLogger(opts.service)
  const role = opts.role ?? 'api'
  const registry = new ModuleRegistry(opts.modules)
  const database = createDatabase({ url: env.DATABASE_URL, max: env.DATABASE_POOL_MAX, log })
  const events = await createEventBus({ url: env.NATS_URL, service: opts.service, log })
  const nats = events instanceof NatsEventBus ? events.connection : undefined
  const redis = env.VALKEY_URL
    ? new Redis(env.VALKEY_URL, { lazyConnect: false, maxRetriesPerRequest: 2 })
    : null
  redis?.on('error', (err: Error) => log.warn({ err: err.message }, 'valkey error'))
  const broker = new ProcedureBroker({ service: opts.service, log, nats })
  const system = systemPrincipal(opts.service)
  const secrets = new Secrets(env.KERN_SECRET)
  const settings = new Settings(broker, system)
  const entitlements = new Entitlements(broker, system)
  const storage = createStorage({
    endpoint: env.S3_ENDPOINT,
    publicEndpoint: env.S3_PUBLIC_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
  })
  const realtime = createRealtime(nats)
  const maintenance = createMaintenance({ database, log })
  const auth = createAuthVerifier({ coreUrl: env.CORE_URL, kernSecret: env.KERN_SECRET })
  const cache: AuthzCache | undefined = redis
    ? {
        get: (k) => redis.get(k),
        set: async (k, v, ttl) => {
          await redis.set(k, v, 'EX', ttl)
        },
        del: async (prefix) => {
          const keys = await redis.keys(`${prefix}*`)
          if (keys.length) await redis.del(...keys)
        },
      }
    : undefined

  let kernel!: Kernel
  const jobs = await createJobs({ url: env.DATABASE_URL, log, kernel: () => kernel })
  const authzStoreFallback: AuthzStore = {
    customRolePermissions: (workspaceId, userId) =>
      broker.call('core.authz.customRolePermissions', { workspaceId, userId }, system),
    bindings: (workspaceId, userId, groupIds, role) =>
      broker.call('core.authz.bindings', { workspaceId, userId, groupIds, role }, system),
  }
  const authz = new Authz(null as unknown as AuthzStore, cache)

  kernel = {
    service: opts.service,
    // the release the image was built as; an explicit option only wins in tests
    version: opts.version ?? env.KERN_VERSION,
    role,
    env,
    log,
    registry,
    database,
    events,
    broker,
    authz,
    jobs,
    settings,
    entitlements,
    secrets,
    storage,
    realtime,
    maintenance,
    auth,
    redis,
    nats,
    system,
    emit: (def, payload, o) => events.publish(def, payload, o),
    call: (name, input, principal = system) => broker.call(name, input, principal),
    isModuleEnabled: async (workspaceId, moduleId) => {
      const mod = registry.get(moduleId)
      if (mod?.definition.core) return true
      return settings.isModuleEnabled(workspaceId, moduleId)
    },
    manifests: () => registry.all().map((m) => toManifest(m.definition)),
    async start() {
      // authz store: core passes a DB-backed one; others resolve over the broker
      ;(authz as any).store = opts.authzStore ? opts.authzStore(kernel) : authzStoreFallback
      authz.registerPermissions(registry.permissions())
      // before any migration runs: a module that cannot run on this platform stops the boot, rather
      // than migrating its schema and then failing somewhere unrelated at request time
      assertModulesSatisfyKernel(registry.all(), kernel.version)
      await maintenance.ensure()
      for (const mod of registry.all()) {
        if (mod.migrationsFolder) await database.migrateModule(mod.definition.id, mod.migrationsFolder)
        if (mod.procedures)
          broker.register(
            mod.definition.id,
            Object.fromEntries(
              Object.entries(mod.procedures).map(([k, p]) => [
                k,
                {
                  input: p.input,
                  output: p.output,
                  handler: (input: unknown, ctx: { principal: Principal }) =>
                    p.handler(input, { kernel, principal: ctx.principal }),
                },
              ]),
            ),
          )
        if (mod.jobs?.length) jobs.register(mod.definition.id, mod.jobs)
        for (const [pattern, handler] of Object.entries(mod.subscriptions ?? {})) {
          await events.subscribe(pattern, (e: EventEnvelope) => handler(e, kernel), {
            durable: `${opts.service}-${mod.definition.id}-${pattern}`,
          })
        }
      }
      // drop cached permissions on changes
      await events.subscribe('core.permissions.changed', async (e) => {
        const p = e.payload as { workspaceId: string; userIds: string[] | null }
        if (p.userIds) for (const u of p.userIds) await authz.invalidate(p.workspaceId, u)
        else await authz.invalidate(p.workspaceId)
      })
      await events.subscribe('core.module.*', async (e) =>
        settings.invalidate((e.payload as any).workspaceId),
      )
      // a plan change must not have to wait out the entitlement cache: somebody who has just paid
      // for a seat expects to use it now, not in thirty seconds. Harmless when nothing bills.
      await events.subscribe('billing.subscription.*', async (e) =>
        entitlements.invalidate((e.payload as any).workspaceId),
      )
      for (const mod of registry.all()) await mod.onBoot?.(kernel)
      if (role !== 'api') await jobs.startWorkers()
      log.info({ service: opts.service, role, modules: registry.ids() }, 'kernel started')
    },
    async stop() {
      for (const mod of registry.all()) await mod.onShutdown?.(kernel)
      await jobs.stop()
      broker.close()
      await events.close()
      redis?.disconnect()
      await database.close()
    },
  }
  return kernel
}
