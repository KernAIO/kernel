---
'@kernhq/kernel': minor
---

Treat a blank environment variable as unset, for every key `KernelEnv` declares. A compose file
passes an unset variable through as the empty string, so `KERN_BASE_URL=`, `S3_ENDPOINT=` and
`S3_PUBLIC_ENDPOINT=` refused to parse ("Invalid URL") and every service threw before binding its
port, while `S3_REGION=`, `S3_BUCKET=`, `KERN_VERSION=`, `DATABASE_POOL_MAX=` and the three database
timeouts silently took the empty string or 0 instead of their default. The schema now maps blank to
`undefined` in one pass, `createLogger` does the same for `LOG_LEVEL` (pino throws on an empty
level), and the fields are exported as `KernelEnvFields` so a test can walk every key.
