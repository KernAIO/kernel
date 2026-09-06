---
'@kernhq/contracts': patch
---

Let a search document declare the permission its hit must clear.

`SearchDocument.acl` is an additive set overlap — core filters with `(acl is null or acl &&
subjects)` — so a **deny** binding is invisible to it and workspace search fails open. Measured
2026-09-06 on a scratch database created from nothing: with a project-scoped deny of
`tracker.project.view` set for one member, `tracker.issues.get` throws FORBIDDEN and `core.search`
returns the issue key, the title and a snippet of the indexed body. `kernel.authz.can` answered
false for the same principal, permission and scope in the same test.

No module can repair this from its own side: there is no subject string that *subtracts*, and
enumerating the real readers instead of the roles would need a "who holds a binding on this scope"
query no core procedure answers, producing a per-document acl the size of the workspace.

So the document now carries an optional `authz: { permission, scope }`, which the search host
resolves through `Authz.can` — the one place that understands a deny. `acl` and `authz` both apply
and neither replaces the other: only `acl` knows a *readership* (a narrow-scope `can()` with no
binding falls through to the caller's workspace set and answers true), and only `authz` knows an
administrator's *decision*.

Deliberately a **patch** and deliberately `.nullish()`. A caret on 0.x cannot cross a minor, so a
minor here invalidates every `contracts` range in the organisation at once; and `.nullish()` leaves
the field absent rather than required at every construction site, so the five modules that build a
`SearchDocument` compile untouched (checked: tracker, chat, quire, hr, inventory). A document
indexed without one is filtered by `acl` alone, exactly as before.
