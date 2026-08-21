# Kern shared libraries

| Package | Purpose |
|---|---|
| `@kernalo/contracts` | Zod schemas, oRPC contracts, events, permissions — the only thing services/modules share |
| `@kernalo/kernel` | module runtime used by every Kern backend service (`defineModule`, registry, events, `call`, authz, jobs, settings, storage, HTTP) |
| `@kernalo/sdk` | typed API + realtime client for the web app and integrations |
| `@kernalo/ui` | Svelte 5 design system + client module SDK (`defineClientModule`) |
| `@kernalo/testing` | Testcontainers helpers and kernel test harness |

Published to GitHub Packages (private phase) — see `.changeset/README.md`. License AGPL-3.0.
