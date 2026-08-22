# CLAUDE.md — Kern project rules

Rules for anyone (human or AI agent) working on Kern repositories. These apply to every repo in the KernAIO org.

## We build in the open
The repositories are **public**, so every commit is visible the moment it is pushed:
- Never commit secrets, tokens, personal data, or machine-specific paths. Use `.env` (gitignored) + `.env.example`.
- Write READMEs, docs, and issue/PR text for external contributors, not for ourselves.
- Keep commit history clean and meaningful — it is part of what people judge the project by.
- Every repo carries LICENSE (AGPL-3.0), CLA.md, CODE_OF_CONDUCT.md, SECURITY.md, CONTRIBUTING.md.

## Git
- Author identity: `Navid Mirzaaghazadeh <mirzaaghazadeh@icloud.com>` (already set in each repo's local git config — plain `git commit` is correct; do not override with `-c`).
- **Do not add `Claude-Session:`, `Co-Authored-By: Claude`, "Generated with", or any AI trailer/branding to commit messages, PRs, or code comments.**
- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, with optional scope). Imperative mood, ≤ 72-char subject.
- Push to `origin main`. Never force-push. If `git pull --rebase` complains about unstaged files that aren't yours (parallel agents share worktrees), use `git -c rebase.autoStash=true pull --rebase`.

## Layout & workflow
- Umbrella dev workspace: `kern/` with sibling repos cloned under `kern/repos/<name>` (gitignored there). pnpm links all `@kernhq/*` packages via the umbrella workspace.
- Install dependencies ONLY via `kern/scripts/pnpm-install-locked.sh` (serialises pnpm at the umbrella root).
- Node 24 (`nvm use 24`), pnpm 10, TypeScript ~5.9, ESM/NodeNext, Biome for lint+format (run `pnpm exec biome check --write <paths>` before committing), Vitest.
- Contracts first: changes to `@kernhq/contracts` / module contracts land (and build) before their consumers.
- Modules own their data: Postgres schema `mod_<id>`, `workspace_id` + RLS on every tenant table, cross-module access only via `kernel.call()` and events. See `modules` repo `packages/_template`.
- Ports: app 5173 · core 4000 · chat 4100 · mail 4200 · collab 4300 · docs 4400.
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
- Skipping a test because its infrastructure is missing is fine on a laptop and dishonest in CI.
  Fail when `process.env.CI` is set.

## Quality bar
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` must pass before pushing.
- UI follows `app/DESIGN.md` (Ink/paper design system) and must work in RTL (fa/ar) and dark mode.
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
