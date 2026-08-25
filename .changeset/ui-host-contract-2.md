---
'@kernhq/ui': minor
---

Complete the host contract: `format`, `i18n`, `realtime`, `uploadFile` and the `Host` seam.

A module's screens are full of dates, counts, translated strings, presence dots and file
attachments, and a module cannot import the app — so all of it moves here, keeping the dependency
pointing one way.

- **`i18n`** — one message runtime, not one per module. The first draft of this lived in
  `@kernhq/module-chat` with its own `t()` and its own `let locale = 'en'`, which was not reactive:
  switching language left every chat string in the previous one. Keys are namespaced by module, so
  a single merged map per locale is collision-free, and numeric placeholders go through
  `Intl.NumberFormat` so a count on a Persian screen reads ۱۲.
- **`format`** — everything except `localPlace`, which needs the app's generated CLDR city data.
- **`realtime`** — `connect()` now takes `{ url, queryClient, getToken }`. It used to read
  `$app/environment` and `$env/dynamic/public` directly, which tied the framework to one
  application's env var names.
- **`uploadFile`** — still exactly one uploader, three steps, and the third is not optional.
- **`Host`** — the seam for the few things only the application can build (a configured API client,
  whether it is running against the mock). Deliberately small: every field is something a
  third-party module may depend on for ever.

`@tanstack/svelte-query` becomes a peer at `^6.1.0` — matching the app rather than guessing, because
two copies of `query-core` in one tree make `QueryClient` structurally incompatible with itself.
