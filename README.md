# Kern shared libraries

| Package | Purpose |
|---|---|
| `@kernhq/contracts` | Zod schemas, oRPC contracts, events, permissions — the only thing services/modules share |
| `@kernhq/kernel` | module runtime used by every Kern backend service (`defineModule`, registry, events, `call`, authz, jobs, settings, storage, HTTP) |
| `@kernhq/sdk` | typed API + realtime client for the web app and integrations |
| `@kernhq/ui` | Svelte 5 design system + client module SDK (`defineClientModule`) |
| `@kernhq/testing` | Testcontainers helpers and kernel test harness |

Published to GitHub Packages (private phase) — see `.changeset/README.md`. License AGPL-3.0.
