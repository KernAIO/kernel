---
'@kernhq/kernel': minor
---

Make a suspended workspace read-only, which is the thing suspension was for.

`Entitlements.requireActive` had no caller anywhere in Kern. `active: false` therefore reached a
banner on the billing screen and nothing else: a workspace that had been suspended, or whose
subscription had been cancelled, kept every write it ever had. `workspaceScoped` now calls it.

Two things decide whether a procedure is a write, and both matter:

- **The contract's method, never the request's.** Every oRPC call arrives as
  `POST /api/<module>/rpc/...`, reads included, so a gate keyed on the wire method would have made a
  suspended workspace unreadable in the app while remaining readable through curl. It reads
  `procedure['~orpc'].route.method`, which is the same value on both surfaces. A procedure that
  declares no method counts as a write.
- **`allowWhileSuspended`**, new, for the writes that must survive suspension or it becomes a trap.
  `billing.subscription.checkout` and `.portal` are both `POST` and both exist to *end* the
  suspension — gating them means the customer trying to pay is the one person who cannot. ADR 0003
  §6 needs the same hatch for export, which is a job somebody starts and therefore a `POST`. Put it
  on the procedure beside `requires(...)`; it is deliberately per-procedure, because a router-level
  exemption would silently cover everything added to that router afterwards.

It falls open three ways, and each is a way this ships wrong if it does not: nothing bills in this
instance (`source: 'none'` — every self-hosted Kern), the biller exists and did not answer
(`source: 'unavailable'` — a billing outage must never turn a paying customer read-only), and
service principals, because internal traffic is not the customer's subscription.
