# @kernhq/testing

## 0.1.14

### Patch Changes

- 08ca7a4: Treat a blank `DATABASE_URL` or `NATS_URL` as unset in `startTestInfra`, the rule `KernelEnv`
  already applies to the whole environment at once.

  Truthiness is not that rule and got both halves wrong. `NATS_URL=''` — what a compose file passes
  for a variable nobody filled in, and what a shell that once exported it still carries — came back
  as `natsUrl: ''`, a string the interface types as a URL. Nothing threw, which is the problem:
  `createEventBus` reads `''` as falsy and returns the in-memory bus, so a suite that asked for
  `{ nats: true }` exercised no broker and still reported green. In the other direction
  `Boolean('   ')` is `true`, so a whitespace-only `DATABASE_URL` satisfied the guard and was handed
  to `pg` as a connection string instead of falling through to Testcontainers.

  `src/infra.test.ts` covers the shared-infra branch, which is where both lived and the one that
  needs no Docker.

- 3323f46: Drop the `@kernhq/kernel` dependency, which nothing in the package imports.

  It has been declared since the `@kernhq` scope rename and appears nowhere in the source or the
  built output — the only `@kernhq` strings in `dist` are comments, one of which says the
  permission-matrix helpers are structural precisely so this package need not depend on the
  framework. `pg` and the Testcontainers packages are the real dependencies.

  The declaration was not harmless. `@kernhq/testing` is a devDependency of twelve repositories, and
  a caret on a 0.x version cannot cross a minor, so every lockfile pinning `@kernhq/testing@0.1.12`
  (which peers `@kernhq/kernel@^0.9.0`) resolved a **second** kernel next to the one the repository
  itself declares. Five were in that state: `collab`, `module-tracker`, `module-chat`, `module-mail`
  (0.10.0 beside 0.9.1) and `module-quire` (0.10.0 beside 0.9.0). Two copies of the kernel are two
  structurally distinct declarations of the same types, which is what makes a consumer report errors
  for procedures that exist.

  Bumping the range would have closed those five and re-opened the class at the next kernel minor;
  removing it ends the class. It also stops the churn it caused — three of this package's last four
  releases were "Updated dependencies → @kernhq/kernel", published for a dependency it never loaded.

## 0.1.13

### Patch Changes

- Updated dependencies [49e4ae4]
- Updated dependencies [0541769]
  - @kernhq/kernel@0.10.0

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
