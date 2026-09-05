---
'@kernhq/testing': patch
---

Treat a blank `DATABASE_URL` or `NATS_URL` as unset in `startTestInfra`, the rule `KernelEnv`
already applies to the whole environment at once.

Truthiness is not that rule and got both halves wrong. `NATS_URL=''` — what a compose file passes
for a variable nobody filled in, and what a shell that once exported it still carries — came back
as `natsUrl: ''`, a string the interface types as a URL. Nothing threw, which is the problem:
`createEventBus` reads `''` as falsy and returns the in-memory bus, so a suite that asked for
`{ nats: true }` exercised no broker and still reported green. In the other direction
`Boolean('   ')` is `true`, so a whitespace-only `DATABASE_URL` satisfied the guard and was handed
to `pg` as a connection string instead of falling through to Testcontainers.

`src/infra.test.ts` covers the shared-infra branch, which is where both lived and the one that
needs no Docker.
