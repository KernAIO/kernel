---
'@kernhq/ui': patch
---

Register the icons an asset register needs

`package`, `boxes`, `warehouse`, `map-pin`, `truck`, `receipt`, `qr-code`, `scan-line` and
`clipboard-list` join the curated registry. Nothing about the package's API changes — `getIcon`,
`registerIcons` and `iconNames` keep their signatures, and `registerIcons` already allowed a
consumer to add these at runtime. What changes is that a module may now name them, which is the
thing `check-icons.mjs` enforces: an unregistered name renders a blank square and throws nothing,
so the registry is where an icon becomes real.

They are here for `module-inventory`, which is growing from an asset register into stock control —
locations, items, movements, suppliers, purchase orders and printed QR labels each need a name the
rail and the command palette can draw.
