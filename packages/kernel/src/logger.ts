import pino, { type Logger } from 'pino'

export type { Logger }
export function createLogger(service: string, level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug')): Logger {
  const pretty = process.env.NODE_ENV !== 'production' && process.stdout.isTTY
  return pino({
    name: service,
    level,
    base: { service },
    redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.secret', '*.apiKey', '*.token'],
    ...(pretty ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,service' } } } : {}),
  })
}
