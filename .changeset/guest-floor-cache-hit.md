---
'@kernhq/kernel': patch
---

Apply the guest deny-floor to a cached permission set, not only to a computed one.

The cache key is `authz:<workspace>:<user>:<permissionVersion>` and names neither the kernel
version nor the service, so an entry written by a replica without the floor was read back verbatim
by one with it. A cloud rolling deploy runs both images against one Valkey on purpose, and the
300-second TTL outlives the last old replica — so the floor was open for the whole deploy and for
up to five minutes after it finished.

Measured against a real Valkey: an old replica cached `chat.message.post` for a guest, the new
replica served it, and an unbound post was allowed. `applyGuestFloor` only deletes keys, so
applying it to a cache hit is idempotent and costs nothing.
