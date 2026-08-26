---
'@kernhq/ui': patch
---

Let a `Select` and a `Table` carry their own accessible name

`Switch` has taken an `ariaLabel` since it was written; `Select` and `Table` never did. A `Select`
fell back to naming itself after its `placeholder`, which names an empty control well and a filled
one badly — a status filter showing "Assigned" still announced itself as "All statuses" — and a
`Table` rendered `role="table"` with no name at all, so a screen reader read "table" and left the
reader to guess which one.

Both now accept `ariaLabel`, and both keep exactly their old behaviour when it is not passed.
