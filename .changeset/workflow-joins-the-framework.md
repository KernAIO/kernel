---
'@kernhq/testing': patch
'@kernhq/ui': patch
---

`@kernhq/kernel` ranges reach the published 0.7.0.

`^0.6.0` does not admit `0.8.0` or `0.7.0` — a caret on 0.x never crosses a minor — so both packages
declared a framework they could no longer install. It passed locally because the workspace is
pinned, and would have failed in any standalone install. `pnpm lint` runs `check-ranges.mjs` now, so
the next one fails here instead of in a consumer's CI.
