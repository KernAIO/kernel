---
'@kernhq/ui': minor
---

`session` carries the workspace's resolved capabilities, and `navigation.go` takes router options.

A module's screens branch on their own capabilities — HR hides the offices column when a workspace
does not use offices — and they were doing it by importing `capabilitiesOf` from the *app's* module
registry and running their own copy of the modules query. A module package cannot import the app,
and two components asking the same question of the same cache is waste besides.

`session.hasCapability('hr', 'attendance')` answers it now, from the set the **server** resolved:
defaults applied, `required` forced on, anything whose dependency is off already pruned. Deriving it
again on the client would be a second implementation of that closure, and two implementations
eventually disagree — the way that shows up is a menu item whose API answers 404.

`navigation.go(href, opts)` accepts `replaceState`, `keepFocus`, `noScroll` and `invalidateAll`.
Dropping them was a real regression: an edit that should not add a history entry did, and a
navigation that must not steal focus from what somebody is typing in, did.
