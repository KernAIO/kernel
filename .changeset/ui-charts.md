---
'@kernhq/ui': minor
---

Charts and `formatBytes` join the framework.

Only tracker draws a chart today, but a chart is a design-system component: the next module that
wants a trend on its dashboard card should find one rather than build a second. `formatBytes` had
two copies — attachments and storage limits — which is one too many for a function whose whole job
is to agree with itself everywhere.

It keeps 1024 and `KB` rather than `Intl`'s SI `kB`, deliberately: the number sits beside the one the
operating system's file browser shows, and a size that disagrees with Finder reads as a bug.
