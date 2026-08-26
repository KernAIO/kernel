---
'@kernhq/ui': patch
---

`{n}` and `{count}` are the same placeholder, because `count` and `n` are the same argument.

`selectPlural` has always accepted either name. Interpolation matched on the exact one — and every
shipped catalogue writes `{n}` while most call sites pass `count`, so those messages chose the right
plural form and then printed the placeholder. On screen: **"{n} other person here"**, on the byline
of a document two people were editing.

It survived because every test in this file used a `{count}` catalogue with a `count` argument,
which is the one pairing of the four that cannot fail. All four are covered now, and one test simply
asserts that nothing `t()` returns still contains a `{placeholder}`.
