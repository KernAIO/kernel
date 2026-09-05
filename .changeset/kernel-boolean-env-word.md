---
'@kernhq/kernel': patch
---

Read `S3_FORCE_PATH_STYLE` as a word rather than as truthiness. `z.coerce.boolean()` is
`Boolean(value)`, so `false`, `0` and `no` were all non-empty strings and all meant `true`: an
instance on an external S3 provider could not turn path-style addressing off. `true`, `1`, `yes`
and `on` (and their opposites, any case) are now the accepted values, and anything else refuses at
boot instead of being read as `true`.
