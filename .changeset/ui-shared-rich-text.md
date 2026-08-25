---
'@kernhq/ui': minor
---

Move the shared rich-text pieces into the framework: mentions, emoji, the pickers, voice recording,
and `navigation.describe`.

These sat in the app and were used by **two** modules, so they belonged to neither. `mentions.ts` in
particular typed against `@kernhq/module-chat`'s `RichDoc` while tracker declares an identical one of
its own — a shared helper picking a winner arbitrarily. `RichDoc` is named structurally here instead;
if a third module grows rich text, the honest move is to lift it into `@kernhq/contracts` and have
all of them import it.

`navigation.describe({ label, icon })` is how a module says what the view it is showing is called.
The shell can only name a screen from its URL — "Chat" — while the module knows it is `eng-core`.
Chat used to reach into the app's tab-strip state to say so; now it states the fact and the shell
decides what to do with it, so an instance with tabs turned off simply does nothing with it. A module
should not know whether tabs exist.
