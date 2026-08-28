---
'@kernhq/kernel': minor
---

Make the tenant boundary and the request edge do what the code already claimed.

**Row-level security was inert in production, and nothing could see it.** Every shipped compose file
connects as the Postgres container's superuser, and a superuser bypasses RLS unconditionally —
`force row level security` binds owners, not superusers. The policies, the FORCE clauses and the
`set_config('app.workspace_id', …)` in `withWorkspace` were all correct and none of them ever
applied. `createDatabase` now asks `pg_roles` who it connected as: in production a role that is a
superuser or carries BYPASSRLS **fails the boot**, naming the role and the fix; elsewhere it warns
once, because a laptop and CI both connect as the superuser. `createKernel` awaits it before the
first migration. `db.rls.test.ts` proves it against a scratch database and a real
`nosuperuser nobypassrls` role: the same query returns one workspace for the owner and every
workspace for the superuser.

**The per-IP rate limit was bypassable by anyone who could type a header.** `allowList` exempted a
request because `x-kern-service` was *present*; the resolver that rejects a bad token does not run
until the route handler. Only a service token that verifies is exempt now. And `trustProxy: true`
made `req.ip` whatever the caller put in `X-Forwarded-For`, so the limiter's key was attacker-chosen
— it is a list of trusted peers from `TRUSTED_PROXIES` now, defaulting to loopback and the private
ranges, which is where Caddy sits in all three shipped topologies.

**`apiRateLimit` had no enforcement site**, which is the shape of promise this project has a rule
about. `workspaceScoped` now spends a per-workspace budget through `kernel.apiBudget`, backed by
Valkey where there is one. Unlimited when nothing bills — no I/O at all on that path, which is every
self-hosted instance — and it never refuses for a reason of its own.

**Entitlements were silently unlimited outside `core`.** `Entitlements.of` gated on `broker.has()`,
which only consults the *local* module registry, so `chat`, `mail` and `collab` resolved UNLIMITED
without asking anybody and every entitlement check written in them was a no-op. Reachability now
includes the bus, and `Entitlement.source` distinguishes `none` (nothing bills), `plan` (a module
answered) and `unavailable` (a biller exists and did not answer). All three fall open; only one of
them is an answer.

**A module can register a raw-body HTTP route.** `ServerModule.httpRoutes` mounts a plain route under
the module's API prefix with the unparsed body, which is the only thing a webhook signature can be
checked against. It is in `@kernhq/kernel` rather than `@kernhq/contracts` because the handler is
typed in Fastify terms and `contracts` is a browser-side dependency with only zod behind it.

**An operator crossing into a customer workspace leaves a trace.** `workspaceScoped` still lets an
instance admin or a service through without a membership, and now emits `kernel.access.crossed`
carrying who, which workspace and which procedure. Fire-and-forget: a sink that throws or a bus that
is down cannot slow or fail the request.

**Query-cost bounds.** `statement_timeout`, `idle_in_transaction_session_timeout` and `lock_timeout`
are set on the request pool (30s / 60s / 10s, env-overridable) so one pathological saved view cannot
occupy a pool every tenant shares. Migrations run on their own connections with none of them, because
a cancelled index build is a host service that never boots.
