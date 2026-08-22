# kernel

**The libraries every Kern service and module is built on.**

A [Kern](https://github.com/KernAIO/kern) module declares what it is: its data, its API, its
permissions and its screens. The runtime in here does the rest. It creates the module's database
schema, mounts its routes, registers its permissions, runs its jobs and delivers its events.

The same libraries are published for anyone else. A module you write uses exactly what ours use.

## Packages

| Package | What it gives you |
|---|---|
| [`@kernhq/contracts`](https://www.npmjs.com/package/@kernhq/contracts) | The shapes every service and module agree on: data, API, events, permission keys |
| [`@kernhq/kernel`](https://www.npmjs.com/package/@kernhq/kernel) | The module runtime: database, migrations, routes, permissions, jobs, events, storage |
| [`@kernhq/sdk`](https://www.npmjs.com/package/@kernhq/sdk) | A typed client for Kern's API, and the realtime connection |
| [`@kernhq/ui`](https://www.npmjs.com/package/@kernhq/ui) | The design system, and how a module declares its screens |
| [`@kernhq/testing`](https://www.npmjs.com/package/@kernhq/testing) | Scratch databases and containers for integration tests |
| [`@kernhq/tsconfig`](https://www.npmjs.com/package/@kernhq/tsconfig) | The TypeScript settings every repository extends |

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
