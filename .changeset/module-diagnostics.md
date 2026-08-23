---
'@kernhq/contracts': minor
'@kernhq/kernel': minor
---

Report what a module actually registered, rather than what it declared.

`describeModule()` walks a module's contract and its router and compares them — the same check every
module's own test does, now runnable against a live instance. It answers the question somebody
building a module asks every few minutes and nothing could answer before: is it wired up, is every
procedure it promised implemented, and what stands in front of each one.

`admin.diagnostics` on the core contract returns it. The existing `admin.modules` reported a manifest
and a hardcoded `healthy: true`.

Two things it deliberately does not do. It does not judge how many middlewares a procedure carries —
a module following the template has two, and core's `admin.*` checks inside the handler instead, so
the count is shown rather than scored. And it reports procedures reachable without signing in as
**public** rather than as a fault: a health check and an intake form are meant to be, but nobody kept
that list, and a procedure that lands on it by accident is invisible until somebody finds it.

`contract` is now attached to every first-party module's `defineServerModule`. It was optional and
nothing set it, so the comparison had nothing to compare against.
