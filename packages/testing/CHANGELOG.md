# @kernhq/testing

## 0.1.12

### Patch Changes

- ddbaa62: Add permission-matrix helpers (effectiveDefaultMatrix, permissionMatrixDiff) so modules can test
  their declared permission defaults against a blessed role matrix.

## 0.1.11

### Patch Changes

- Updated dependencies [7b8b0c8]
  - @kernhq/kernel@0.9.0

## 0.1.10

### Patch Changes

- Updated dependencies [ba49174]
  - @kernhq/kernel@0.8.0

## 0.1.9

### Patch Changes

- docs: update repo references for kern->app and app->shell rename
- Updated dependencies
  - @kernhq/kernel@0.7.1

## 0.1.8

### Patch Changes

- 4c37134: `@kernhq/kernel` ranges reach the published 0.7.0.

  `^0.6.0` does not admit `0.8.0` or `0.7.0` — a caret on 0.x never crosses a minor — so both packages
  declared a framework they could no longer install. It passed locally because the workspace is
  pinned, and would have failed in any standalone install. `pnpm lint` runs `check-ranges.mjs` now, so
  the next one fails here instead of in a consumer's CI.

## 0.1.7

### Patch Changes

- Updated dependencies [3bd7675]
  - @kernhq/kernel@0.7.0

## 0.1.6

### Patch Changes

- Updated dependencies [b90f848]
  - @kernhq/kernel@0.6.0

## 0.1.5

### Patch Changes

- Updated dependencies [4f7d500]
  - @kernhq/kernel@0.5.0

## 0.1.4

### Patch Changes

- d1b5a33: Relicense the framework under Apache-2.0. These packages are what a third-party module imports, and
  under AGPL nobody could write a closed module for their own instance. The Kern product — app, core,
  chat, mail, collab, docs and the first-party modules — stays AGPL-3.0-only. See LICENSING.md and
  ADR 0005 in the `kern` repository.
- Updated dependencies [d1b5a33]
  - @kernhq/kernel@0.4.1

## 0.1.3

### Patch Changes

- Updated dependencies [df96baf]
  - @kernhq/kernel@0.4.0

## 0.1.2

### Patch Changes

- Updated dependencies [2caf0c2]
  - @kernhq/kernel@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies [0a89f1b]
- Updated dependencies [0a89f1b]
- Updated dependencies [0a89f1b]
- Updated dependencies [0a89f1b]
  - @kernhq/kernel@0.2.0
