---
'@kernhq/kernel': minor
'@kernhq/ui': minor
---

Module messages can be counted.

`ClientModule.messages` accepted `Record<string, string>`, so a module could not express a plural at
all — and a counted message is not a string with `{count}` in it. English has two forms and Arabic
has six, and which one applies is `Intl.PluralRules`' answer rather than the author's. A message is
now a string *or* a map of CLDR plural category to string, and `t(key, { count })` picks the form,
falling back to `other` — the one category every locale has.

This is additive for anything already constructing a bundle: a plain string is still a `Message`.
