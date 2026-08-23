# kernel

**The libraries every Kern service and module is built on.**

[![CI](https://img.shields.io/github/actions/workflow/status/KernAIO/kernel/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/KernAIO/kernel/actions/workflows/ci.yml)
[![Licence](https://img.shields.io/badge/licence-AGPL--3.0-blue?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-pre--1.0-orange?style=flat-square)](https://github.com/KernAIO/kern#what-works-today)
[![Last commit](https://img.shields.io/github/last-commit/KernAIO/kernel?style=flat-square)](https://github.com/KernAIO/kernel/commits/main)
[![Website](https://img.shields.io/badge/kernaio.com-1f2328?style=flat-square)](https://kernaio.com)

A [Kern](https://github.com/KernAIO/kern) module declares what it is: its data, its API, its
permissions and its screens. The runtime in here does the rest. It creates the module's database
schema, mounts its routes, registers its permissions, runs its jobs and delivers its events.

The same libraries are published for anyone else. A module you write uses exactly what ours use.

## Packages

| Package | What it gives you | Version |
|---|---|---|
| [`@kernhq/contracts`](https://www.npmjs.com/package/@kernhq/contracts) | The shapes every service and module agree on: data, API, events, permission keys | [![npm](https://img.shields.io/npm/v/@kernhq/contracts?style=flat-square&label=)](https://www.npmjs.com/package/@kernhq/contracts) |
| [`@kernhq/kernel`](https://www.npmjs.com/package/@kernhq/kernel) | The module runtime: database, migrations, routes, permissions, jobs, events, storage | [![npm](https://img.shields.io/npm/v/@kernhq/kernel?style=flat-square&label=)](https://www.npmjs.com/package/@kernhq/kernel) |
| [`@kernhq/sdk`](https://www.npmjs.com/package/@kernhq/sdk) | A typed client for Kern's API, and the realtime connection | [![npm](https://img.shields.io/npm/v/@kernhq/sdk?style=flat-square&label=)](https://www.npmjs.com/package/@kernhq/sdk) |
| [`@kernhq/ui`](https://www.npmjs.com/package/@kernhq/ui) | The design system, and how a module declares its screens | [![npm](https://img.shields.io/npm/v/@kernhq/ui?style=flat-square&label=)](https://www.npmjs.com/package/@kernhq/ui) |
| [`@kernhq/testing`](https://www.npmjs.com/package/@kernhq/testing) | Scratch databases and containers for integration tests | [![npm](https://img.shields.io/npm/v/@kernhq/testing?style=flat-square&label=)](https://www.npmjs.com/package/@kernhq/testing) |
| [`@kernhq/tsconfig`](https://www.npmjs.com/package/@kernhq/tsconfig) | The TypeScript settings every repository extends | [![npm](https://img.shields.io/npm/v/@kernhq/tsconfig?style=flat-square&label=)](https://www.npmjs.com/package/@kernhq/tsconfig) |

Install any of them from npm. They are public and need no credentials.

```bash
pnpm add @kernhq/kernel @kernhq/contracts
```

## Work on them

Goal: change a library and see the change in the services that use it.

You need:

- Node 24 and pnpm 10.

### 1. Install and build

```bash
pnpm install
pnpm build
```

**Expected result:** every package has a `dist/` directory.

### 2. Check your change

```bash
pnpm typecheck
pnpm test
```

**Expected result:** both report success.

### 3. Describe the change for the release

```bash
pnpm changeset
```

Choose the packages you changed, choose how big the change is, and write what changed for somebody
using the package.

**Expected result:** a new file in `.changeset/`.

When your change reaches `main`, the release runs on its own. It bumps the versions, publishes the
packages to npm, and pushes the version commit back.

## Things worth knowing

- **Contracts land first.** A change here is published before the services that depend on it are
  updated. Skip that order and every other repository's build turns red.
- **Packages go to npm, not GitHub Packages.** GitHub Packages asks for a token even for public
  packages, which would mean nobody could install Kern without credentials.
- **`@kernhq/tsconfig` exists because every repository is built on its own** in CI, where a config
  file at the root of a local workspace does not exist.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [CLAUDE.md](CLAUDE.md). Licence: [AGPL-3.0](LICENSE).

---

**Kern** — one place for your team's work: issues, conversations, documents and people.
Open source, self-hosted. [kernaio.com](https://kernaio.com) · [github.com/KernAIO](https://github.com/KernAIO)
