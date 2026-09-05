import pino, { type Logger } from 'pino'

export type { Logger }

/**
 * `??` does not catch the empty string, and `LOG_LEVEL: ''` is what a compose file passes for a
 * variable nobody filled in. pino answers an empty level with "default level: must be included in
 * custom levels" and throws — from the second line of `createKernel`, so the service dies before it
 * has a logger to say so with. Blank means unset here for the same reason it does in `config.ts`.
 */
const set = (value: string | undefined) => (value?.trim() ? value : undefined)

export function createLogger(service: string, level?: string): Logger {
  const resolved =
    set(level) ?? set(process.env.LOG_LEVEL) ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
  const pretty = process.env.NODE_ENV !== 'production' && process.stdout.isTTY
  return pino({
    name: service,
    level: resolved,
    base: { service },
    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.secret',
      '*.apiKey',
      '*.token',
    ],
    ...(pretty
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,service' },
          },
        }
      : {}),
  })
}
