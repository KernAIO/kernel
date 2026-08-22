# Kern shared libraries

| Package | Purpose |
|---|---|
| `@kernaio/contracts` | Zod schemas, oRPC contracts, events, permissions — the only thing services/modules share |
| `@kernaio/kernel` | module runtime used by every Kern backend service (`defineModule`, registry, events, `call`, authz, jobs, settings, storage, HTTP) |
| `@kernaio/sdk` | typed API + realtime client for the web app and integrations |
| `@kernaio/ui` | Svelte 5 design system + client module SDK (`defineClientModule`) |
| `@kernaio/testing` | Testcontainers helpers and kernel test harness |

Published to GitHub Packages (private phase) — see `.changeset/README.md`. License AGPL-3.0.
