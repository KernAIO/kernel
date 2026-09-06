---
'@kernhq/ui': patch
---

`SidebarSwitcher` takes the avatar's identity as `avatarId`, so the button keeps its own `id`.

The prop was called `id`, which is also the DOM attribute the component's `HTMLButtonAttributes`
declares — so a caller passing the workspace id shadowed the id the menu primitive had put in the
trigger props, and the button rendered with no id at all. bits-ui decides whether a pointer landed on
a trigger by comparing `event.target.id` with the trigger's id, and two empty strings match: every
click on an element without an id read as a click on the trigger, so the workspace switcher's menu
stayed open until the page navigated. Measured in a browser against the shell's mock backend, before
and after: the trigger now renders `id="bits-c5"` and an outside click closes the menu.

`id` on `SidebarSwitcher` is now the button's id, as its type always said. A caller that was passing
an identity there should pass `avatarId`.
