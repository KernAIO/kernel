# CLAUDE.md — Kern project rules

Rules for anyone (human or AI agent) working on Kern repositories. These apply to every repo in the KernAIO org.

## We build in the open
The repositories are **public**, so every commit is visible the moment it is pushed:
- Never commit secrets, tokens, personal data, or machine-specific paths. Use `.env` (gitignored) + `.env.example`.
- Write READMEs, docs, and issue/PR text for external contributors, not for ourselves.
- Keep commit history clean and meaningful — it is part of what people judge the project by.
- Every repo carries LICENSE, CLA.md, CODE_OF_CONDUCT.md, SECURITY.md, CONTRIBUTING.md.
- **Two licences, split at the framework boundary.** The `kernel` repo and `modules`'
  `_template` + `workflow` are **Apache-2.0** so anyone can write a closed module; the product —
  `shell`, `core`, `chat`, `mail`, `collab`, `docs`, this umbrella, the first-party modules — is
  **AGPL-3.0-only**. A new package inherits its repo's licence unless it is something a third-party
  module must import, and then it is Apache-2.0 with its own LICENSE file. Apache-2.0 packages take
  only permissive dependencies. If a module author has to import an AGPL package to get something
  done, move the API — never the licence. See `LICENSING.md` and
  `docs/adr/0005-licensing-and-the-module-boundary.md`.

## Git
- Author identity: `Navid Mirzaaghazadeh <mirzaaghazadeh@icloud.com>` (already set in each repo's local git config — plain `git commit` is correct; do not override with `-c`).
- **Do not add `Claude-Session:`, `Co-Authored-By: Claude`, "Generated with", or any AI trailer/branding to commit messages, PRs, or code comments.**
- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, with optional scope). Imperative mood, ≤ 72-char subject.
- Push to `origin main`. Never force-push. If `git pull --rebase` complains about unstaged files that aren't yours (parallel agents share worktrees), use `git -c rebase.autoStash=true pull --rebase`.
- **Never `git add -A` or `git add .`. Stage the paths you changed, by name.** Several agents share
  these checkouts, and another one is very often part-way through a new package in the same repo.
  `git add -A` sweeps their half-finished files into your commit and pushes them — under your commit
  message, without their lockfile entry, so CI fails at install for everyone. It happened on
  2026-08-24: a contact-address fix carried two unfinished modules into `main`. Run
  `git status --porcelain` first and stage from it; if you cannot name every path you are about to
  commit, you are not ready to commit. When it does happen, do not revert the other agent's files —
  they are still working on them; tell them instead, and repair what you broke.

## Layout & workflow
- Umbrella dev workspace: `app/` with sibling repos cloned under `app/repos/<name>` (gitignored there). pnpm links all `@kernhq/*` packages via the umbrella workspace.
- Install dependencies ONLY via `app/scripts/pnpm-install-locked.sh` (serialises pnpm at the umbrella root).
- Node 24 (`nvm use 24`), pnpm 10, TypeScript ~5.9, ESM/NodeNext, Biome for lint+format (run `pnpm exec biome check --write <paths>` before committing), Vitest.
- Contracts first: changes to `@kernhq/contracts` / module contracts land (and build) before their consumers.
- Modules own their data: Postgres schema `mod_<id>`, `workspace_id` + RLS on every tenant table, cross-module access only via `kernel.call()` and events. See `modules` repo `packages/_template`.
- Ports: shell 5173 · core 4000 · chat 4100 · mail 4200 · collab 4300 · docs 4400.
- Dev DB on this machine: Homebrew Postgres 18 at `localhost:5432` (`kern`/`kern`); the compose Postgres listens on `${KERN_PG_PORT:-5432}` (5433 here).

## CI
Every service repository's CI runs the real suites, so the workflow starts the infrastructure they
need as service containers: Postgres (`pgvector/pgvector:pg18`) everywhere, Valkey for `chat`,
Mailpit for `mail`. Things learned the hard way:
- Address a service container as **127.0.0.1**, never `localhost` — a runner resolves `localhost` to
  `::1` first, where the published port is not listening, and `fetch` does not retry over IPv4.
- Do not set `registry-url` on `actions/setup-node` in an install job. It writes an `.npmrc` with a
  placeholder token, and npm answers a bad token with **404**, so public packages appear to vanish.
- A repository is built **standalone** in CI. `workspace:*` only resolves inside the umbrella
  workspace; depend on the published version instead.
- **Each repository's own `pnpm-lock.yaml` is what CI installs from, and you cannot refresh it from
  inside the umbrella.** Add a dependency to a package and the umbrella install updates the *umbrella*
  lockfile, leaving the repo's committed one stale — CI then fails every job at
  `ERR_PNPM_OUTDATED_LOCKFILE`, install-time, before a single test runs. Plain `pnpm install` in
  `repos/<name>` walks up and attaches to the umbrella; `--ignore-workspace` skips `packages/*` and
  cheerfully reports nothing to do. Clone the repo somewhere outside the workspace and run
  `pnpm install --lockfile-only` there, then copy the lockfile back.
- Skipping a test because its infrastructure is missing is fine on a laptop and dishonest in CI.
  Fail when `process.env.CI` is set.

## Writing
Documentation — READMEs, guides, runbooks, `docs/`, and any procedure someone follows — uses the
`adhd-friendly-ste-technical-writer` skill in `.claude/skills/`: goal first, one action per step,
short sentences, conditions before commands, an observable result after every important action.
It is a house style inspired by ASD-STE100, not certified compliance — do not claim otherwise.
It governs documents for readers. Code comments and commit messages keep the voice they have.

## Quality bar
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` must pass before pushing.
- UI follows `shell/DESIGN.md` (Ink/paper design system) and must work in RTL (fa/ar) and dark mode.
- All user-facing strings go through i18n (Paraglide) — no hardcoded English in components.

## Keeping this file current
This file is how the next person — or the next agent — avoids repeating what we already worked out.
When you learn something durable, add it here **in the same commit as the change that taught you**:
- a trap that cost you time (a silent failure, a misleading error, a tool that lies about success)
- a convention you had to infer from reading several files
- a decision and the reason behind it, especially where the obvious choice is wrong
Keep it specific and short. Delete anything that stops being true — a stale note is worse than none.

---

# This repository: kernel (shared libraries)

Publishes the packages every other repository consumes: `@kernhq/contracts` (Zod models, oRPC
contracts, events, permissions), `@kernhq/kernel` (the module runtime), `@kernhq/sdk` (typed API and
realtime client), `@kernhq/ui` (the Ink/paper design system), `@kernhq/testing`, `@kernhq/tsconfig`.

**Things worth knowing**
- **Contracts first.** A change here lands and publishes before its consumers are updated. Breaking a
  contract without publishing leaves every other repository's CI red.
- Packages go to **npm**, not GitHub Packages — the latter demands a token even for public packages,
  which would mean nobody could install without credentials. Publishing is authenticated with the
  `NPM_TOKEN` organisation secret; installing is anonymous.
- `@kernhq/tsconfig` exists because every repository is built standalone in CI, where a config file at
  the root of the local workspace does not exist. Never point a repo's `tsconfig` outside its own
  checkout.
- `Omit<Union, K>` collapses a discriminated union. `Realtime`'s publisher types distribute over
  `ServerMessage` on purpose — see `src/realtime.ts`.
- Biome 2.5 refuses a nested config that extends a root one unless it declares `"root": false`
  (`packages/ui/biome.json`).
- An ESM-only package still needs a `default` condition in its `exports`, or tools that resolve
  without the `import` condition (drizzle-kit among them) cannot find it.
- **`@kernhq/ui` ships `dist`, so editing `src` changes nothing until `pnpm --filter @kernhq/ui build`.**
  The consumer is symlinked to the package directory, which makes it look live, but `exports` points
  at `./dist/index.js` — the app keeps rendering the last built copy. Worse, `pnpm typecheck` runs
  `svelte-check` over `src` and passes, so a broken or simply unbuilt change reports green. Verify a
  UI change in a browser against the computed style, not by type-checking. (Contrast a module's
  `./client`, which ships as source and *is* live once linked — the two behave oppositely.)
- **A bits-ui part that reads a context must sit inside the part that provides it.** `Select`
  rendered `Select.GroupHeading` without a `Select.Group` around it, so every grouped select threw
  "Context ... not found" on open and simply never appeared — no compile error, and the ungrouped
  path (everything that existed until then) kept working. When a headless primitive has a wrapper,
  it is load-bearing.
- **`create ... if not exists` is not atomic in Postgres.** Two sessions both see "not there", both
  insert into the catalogue, and the loser gets a unique violation instead of the no-op it asked for.
  Every service boots at once, so this is the normal case: `migrateModule` holds an advisory lock
  across schema creation *and* migration, and `ignoringDuplicate` treats 23505/42P06/42P07 as
  success. A test with four concurrent `migrateModule` calls found this — the lock alone was not
  enough because `ensureSchema` ran outside it.
- The kernel's version is `KERN_VERSION` from the image, not a constant a service passes in. A
  service that passes `version:` to `createKernel` overrides the release and makes `/api/health` lie;
  only tests should do it.
- **A layer is never a number you pick; it is `--kern-z-*` in `tokens.css`.** Everything that leaves
  its surface is portalled to `<body>`, so one stacking context orders all of it and the only thing
  deciding what a pointer hits is those numbers. Picked per component, they were wrong: a select
  popup at 60 under a dialog overlay at 70, so every dialog in Kern containing a select had an
  unclickable control and nothing in any one file looked wrong. The rule the scale encodes is that a
  popup is opened *from* a surface and a surface is never opened from a popup, so menus, selects and
  popovers sit above every drawer, sheet, dialog and command palette. `layers.test.ts` fails when a
  component writes a literal.
- **Global CSS in a component's `<style>` disappears with the component.** `Select` emits `.kmenu`
  and `.kmenu-item` but never renders `MenuItems.svelte`, where those rules lived — so a bundler
  that dropped the unused menu components dropped the select's ground, border and layer with them.
  `:global()` rules several components depend on belong in `src/lib/styles/`, not in whichever one
  was written first.
- **Do not declare a property a third-party plugin clears with an inline style.** The drag-handle
  extension shows its grip with `element.style.visibility = ''`, so a `visibility` rule in the
  stylesheet would be what it falls through to and the grip would never come back. Render the
  element with the inline style already set instead. The rule it replaced keyed on a `hide` class
  nothing ever added, which is a shape worth checking for: `:not(.x)` against `.x` always resolves
  to the first branch when nothing sets `x`, and it reads as if it does the opposite.
- **`@kernhq/ui` has one test that opens a browser** (`tests/layering.browser.test.ts`: a Vite dev
  server, `playwright-core`, Chromium). Whether a pointer aimed at a menu item reaches it has no
  answer in a DOM without layout, which is why the defect above survived every other check. CI
  installs Chromium before `pnpm test`; a laptop without one skips, CI does not.
- **A block in the schema with no way to type it is a schema, not a feature.** Callouts, tables and
  toggles were in `PAGE_DOC_NODES` and in the renderer for as long as they existed and no menu
  offered them; `@` and `+` in a page were worse, because the builder had asked for `onSuggest`
  since it was written and the component never passed it. `slash.test.ts` now checks the `/` list
  against `PAGE_DOC_NODES`, so a node with no entry point has to be named in
  `SLASH_STRUCTURAL_NODES` with a reason.
- **A `--lockfile-only` regeneration silently unlinks the workspace packages** once the registry has
  a version newer than the local one. `link-workspace-packages=true` links only when the workspace
  copy is the *highest* satisfying version — contracts is 0.6.0 here and 0.6.1 is published, so the
  refreshed lockfile pointed three packages at npm instead of at `../contracts`. Add
  `prefer-workspace-packages=true` to the clone's `.npmrc` for the regeneration and the diff is your
  dependency and nothing else.
- **A superuser bypasses row-level security, so every tenant policy in Kern was decorative.**
  `enable`, `force`, the policy and `withWorkspace`'s `set_config` were all correct and none of them
  applied, because every compose file connected as the Postgres container's superuser — and `force
  row level security` binds *owners*, not superusers. Nothing failed, no test could see it, and the
  only way to observe it is to compare the rows two roles get from the same query. `createDatabase`
  now reads `rolsuper`/`rolbypassrls` and refuses to boot in production; `db.rls.test.ts` is the
  proof, and any change to policies or ownership belongs beside it. The general rule: **a security
  control whose failure mode is "nothing happens" needs a test that observes the data, not the
  configuration.**
- **A refusal that prescribes a fix the reader cannot run is not a fix.** That RLS boot refusal
  first shipped telling the operator to `reassign owned by <current owner> to kern_app` — and on the
  shipped stack the current owner *is* the bootstrap superuser, so the command needs the exact
  privilege the message is telling them to stop using. It also stopped one step short: creating the
  role by hand on a fresh external database gets past the refusal and into `permission denied to
  create extension "vector"` from core's `0000_init.sql`, with nothing pointing anywhere. `vector`
  and `pg_stat_statements` are the untrusted ones; `pg_trgm`, `pgcrypto`, `ltree` and `btree_gist`
  are trusted and a nosuperuser owner creates them fine. The message now branches on shipped-stack
  versus external Postgres, because the two actions have nothing in common. Read an error you write
  as the person who will receive it, and check they hold the privileges every line of it assumes.
- **`broker.has()` is local-only, and reading it as "does this exist" is a silent no-op.** It
  consults this process's module registry and nothing else, so `chat`, `mail` and `collab` asking
  `has('billing.entitlements.get')` always got `false` — every entitlement check in those services
  resolved UNLIMITED without asking anybody. Use `mightAnswer()` and then let the call decide: NATS
  answers a request with no subscriber immediately (`503 no responders`), which is what makes
  "nobody hosts this" a *fact* rather than a timeout. `call()` marks the two apart with `reason`
  (`NO_RESPONDERS` vs `RPC_UNREACHABLE`) and keeps the code `UNAVAILABLE`, because consumers already
  branch on the code.
- **A module can ship a raw-body HTTP route; `extend` is the service's, not the module's.**
  `ServerModule.httpRoutes` mounts a plain Fastify route under the module's API prefix, in its own
  encapsulated scope, with `parseAs: 'buffer'` when `raw` — the only thing a webhook signature can
  be checked against. The type lives in `@kernhq/kernel` and not in `@kernhq/contracts` on purpose:
  the handler is typed in Fastify terms and `contracts` has zod and `@orpc/contract` behind it and
  is imported by the browser. Encapsulation is load-bearing — a content-type parser added on the
  instance replaces oRPC's pass-through one and every request body then arrives as `undefined`.
- **`trustProxy: <number>` is ignored by Fastify 5 and fails closed.** The documentation offers a
  hop count; `getTrustProxyFn` turns a number into `() => false`, deliberately, because a hop count
  cannot validate the immediate peer. So a number trusts *nothing* rather than the hops it looks
  like it asks for. Name the proxies instead — an address, a CIDR, or `loopback` / `uniquelocal` /
  `linklocal`, which is what `TRUSTED_PROXIES` takes.
- **An unset variable in a compose file arrives as the empty string, not as absent, and every
  service loads `KernelEnv`.** All three shipped stacks pass each variable through unconditionally
  (`S3_ENDPOINT: ${S3_ENDPOINT}`), so a line nobody filled in hands zod a *value* to validate. Half
  the schema refused it — `''` is "Invalid URL" for `KERN_BASE_URL`, `S3_ENDPOINT` and
  `S3_PUBLIC_ENDPOINT`, thrown by `loadEnv` before the service binds its port, in every service at
  once. The other half was quietly wrong, which is worse, because a `.default()` only fires for
  `undefined`: `S3_REGION: ''` signed against no region, `KERN_VERSION: ''` made `/api/health`
  report an empty release, and `Number('')` is 0, so `DATABASE_POOL_MAX: ''` was a pool of zero and
  `DATABASE_STATEMENT_TIMEOUT_MS: ''` removed the only ceiling on a runaway query. `config.ts` maps
  blank to `undefined` for the whole object at once — per field is a rule the next field has to
  remember — and `config.test.ts` walks every key the schema declares, so a key added later is
  covered without anybody coming back here. Anything reading `process.env` outside the schema needs
  the same rule spelled out: `??` does not catch `''`, which is how `LOG_LEVEL: ''` reached pino as
  a level and threw "default level: must be included in custom levels" out of `createLogger`.
- **A `statement_timeout` on the pool would kill migrations, so migrations get their own
  connections.** The request pool carries `statement_timeout`, `idle_in_transaction_session_timeout`
  and `lock_timeout`; `migrateSchema` runs on a separate pool with none of them, and the advisory
  lock takes a dedicated `pg.Client` rather than a connection from that pool. The lock waiter holds
  its connection for as long as the winner takes, so pooling the two together deadlocks — four
  concurrent `migrateModule` calls against a pool of two never returned, and `db.test.ts` catches it.
