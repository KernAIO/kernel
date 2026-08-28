---
'@kernhq/ui': patch
---

The framework's own words are seeded, not registered by an import side effect.

`common-messages.ts` ended with a loop calling `registerMessages`, and a side effect at import is
exactly what a bundler is licensed to remove: this package's `sideEffects` field names only CSS, so
Rollup duplicated the *data* into six client chunks and kept the loop in one — which tracker's
settings routes never load. Every `common.*` key on those screens rendered as itself. A button read
`common.add`, which is why `getByRole('button', { name: 'Add' })` matched nothing and thirteen
end-to-end tests waited out a thirty-second timeout apiece.

`i18n.svelte.ts` seeds them into its own map at initialisation instead, so nothing depends on a
module being evaluated. `bundles` is also `$state` now: a bundle registered after a screen has
already drawn re-renders it, which is what the comment above it always claimed and never did.
