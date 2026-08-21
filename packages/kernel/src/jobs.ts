import { type Job, PgBoss, type ScheduleOptions, type SendOptions } from 'pg-boss'
import type { Logger } from './logger.js'
import type { JobDef } from './module.js'

export interface Jobs {
  boss: PgBoss
  send<T>(name: string, data: T, opts?: SendOptions): Promise<string | null>
  schedule(name: string, cron: string, data?: object, opts?: ScheduleOptions): Promise<void>
  /** Register handlers (worker role). Call `startWorkers()` afterwards. */
  register(module: string, defs: JobDef[]): void
  startWorkers(): Promise<void>
  stop(): Promise<void>
}

/**
 * pg-boss on the shared Postgres (schema `kern_jobs`). Job names are `<module>.<job>`.
 * API processes only `send`; worker processes call `startWorkers()`.
 */
export async function createJobs(opts: { url: string; log: Logger; kernel: () => unknown }): Promise<Jobs> {
  const boss = new PgBoss({ connectionString: opts.url, schema: 'kern_jobs' })
  boss.on('error', (err: Error) => opts.log.error({ err }, 'pg-boss error'))
  await boss.start()
  const registered: Array<{ name: string; def: JobDef }> = []
  return {
    boss,
    async send(name, data, o) {
      await boss.createQueue(name).catch(() => {})
      return boss.send(name, data as object, o)
    },
    async schedule(name, cron, data = {}, o) {
      await boss.createQueue(name).catch(() => {})
      await boss.schedule(name, cron, data, o)
    },
    register(module, defs) {
      for (const def of defs) registered.push({ name: `${module}.${def.name}`, def })
    },
    async startWorkers() {
      for (const { name, def } of registered) {
        await boss
          .createQueue(name, {
            retryLimit: def.options?.retryLimit ?? 3,
            retryDelay: def.options?.retryDelay ?? 10,
            retryBackoff: def.options?.retryBackoff ?? true,
            expireInSeconds: def.options?.expireInSeconds ?? 900,
          })
          .catch(() => {})
        await boss.work(name, { batchSize: 1, pollingIntervalSeconds: 1 }, async ([job]: Job<unknown>[]) => {
          if (!job) return
          const input = def.schema ? def.schema.parse(job.data) : job.data
          await def.handler(input, {
            kernel: opts.kernel() as any,
            id: job.id,
            attempt: (job as any).retryCount ?? 0,
          })
        })
        if (def.cron) await boss.schedule(name, def.cron, {}, { tz: 'UTC' })
        opts.log.info({ job: name, cron: def.cron }, 'job worker started')
      }
    },
    async stop() {
      await boss.stop({ graceful: true, timeout: 10_000 })
    },
  }
}
