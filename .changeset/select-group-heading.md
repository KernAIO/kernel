---
'@kernhq/ui': patch
---

Fix `Select`'s `group` option: a group heading was rendered outside `Select.Group`, whose context it
reads, so any grouped select threw on open and never showed its list.
