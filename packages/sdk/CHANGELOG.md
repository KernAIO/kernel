# @kernhq/sdk

## 0.1.6

### Patch Changes

- 6e14235: Treat `welcome`, not the open socket, as the moment the realtime connection exists.

  The client sent its channel subscriptions immediately after `hello`, in the same tick, and the
  gateway closed anything that arrived before it had authenticated the socket — so a good session was
  rejected whenever both frames landed in one read, and the client reconnected into the same race.
  Resetting the backoff on `onopen` made that loop run about twice a second for as long as it lasted.
  Subscriptions now wait for `welcome`, the backoff only resets there, and a first connection no
  longer invalidates every query the page has just run.

## 0.1.5

### Patch Changes

- Updated dependencies [b90f848]
  - @kernhq/contracts@0.5.0

## 0.1.4

### Patch Changes

- Updated dependencies [4f7d500]
  - @kernhq/contracts@0.4.0

## 0.1.3

### Patch Changes

- d1b5a33: Relicense the framework under Apache-2.0. These packages are what a third-party module imports, and
  under AGPL nobody could write a closed module for their own instance. The Kern product — app, core,
  chat, mail, collab, docs and the first-party modules — stays AGPL-3.0-only. See LICENSING.md and
  ADR 0005 in the `kern` repository.
- Updated dependencies [d1b5a33]
  - @kernhq/contracts@0.3.1

## 0.1.2

### Patch Changes

- Updated dependencies [df96baf]
  - @kernhq/contracts@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies [0a89f1b]
- Updated dependencies [0a89f1b]
- Updated dependencies [0a89f1b]
- Updated dependencies [0a89f1b]
  - @kernhq/contracts@0.2.0
