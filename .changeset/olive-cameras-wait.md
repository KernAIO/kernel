---
'@kernhq/kernel': patch
'@kernhq/ui': patch
---

`ClientModule` can declare `overlays`: components the shell mounts once per workspace and keeps.

Every other contribution a module makes lives inside a page, so a navigation destroys it. That is
right for a screen and wrong for anything a person would lose — something in progress, an upload,
a countdown. An overlay is mounted when the workspace opens and unmounted when it closes, gated on
the same optional `permission` and `capability` as a sidebar or a widget, and handed `workspaceId`
and `workspaceSlug` through `OverlayProps`. It is deliberately given no location: an overlay
outlives the route it was mounted on, so a `pathname` passed in as a prop would be a stale one.
A module that needs to know where the person is reads `navigation` from `@kernhq/ui`.

`ClientModule.onActivate` has been declared since the interface was written and the app calls it
nowhere. It is also the wrong shape for this: it returns `void`, so it cannot declare a component,
and anything it mounted imperatively would sit outside the app's tree with nothing to tear it down
— a module still running in a browser that has signed out.

Both packages take a **patch** on purpose. `overlays` is one optional field on an interface nothing
constructs by hand, so every existing caret range reaches it; the identical change released as a
minor would invalidate every `@kernhq/kernel` and `@kernhq/ui` range in the organisation at once,
which one optional field in `@kernhq/contracts` cost thirteen repositories on 2026-09-05.
