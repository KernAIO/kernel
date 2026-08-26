---
'@kernhq/sdk': patch
'@kernhq/ui': patch
---

Treat `welcome`, not the open socket, as the moment the realtime connection exists.

The client sent its channel subscriptions immediately after `hello`, in the same tick, and the
gateway closed anything that arrived before it had authenticated the socket — so a good session was
rejected whenever both frames landed in one read, and the client reconnected into the same race.
Resetting the backoff on `onopen` made that loop run about twice a second for as long as it lasted.
Subscriptions now wait for `welcome`, the backoff only resets there, and a first connection no
longer invalidates every query the page has just run.
