---
'@kernhq/kernel': patch
---

`requiresCapability` stops claiming a capability is switched off when a dependency is what pruned it.

The resolved capability set is a closure: a capability drops out either because its own switch is
off, or because something it depends on is. The middleware is handed the answer rather than the
working, so it cannot tell which — and it was saying "is not enabled in this workspace" for both.

An administrator hitting the second case is told a switch they can see is on is off, and goes to
toggle a setting that was already correct. Measured on `hr.payroll_export`, which depends on
`attendance` and `periods`: with either of those off, all three refusals read identically.

The message now names both possibilities instead of asserting the one it cannot verify. Naming the
actual missing dependency needs the module's declarations, which live in the registry and are not
reachable from the middleware — worth doing when something else needs the kernel to expose them.
