---
'@kernhq/testing': patch
---

Drop the `@kernhq/kernel` dependency, which nothing in the package imports.

It has been declared since the `@kernhq` scope rename and appears nowhere in the source or the
built output — the only `@kernhq` strings in `dist` are comments, one of which says the
permission-matrix helpers are structural precisely so this package need not depend on the
framework. `pg` and the Testcontainers packages are the real dependencies.

The declaration was not harmless. `@kernhq/testing` is a devDependency of twelve repositories, and
a caret on a 0.x version cannot cross a minor, so every lockfile pinning `@kernhq/testing@0.1.12`
(which peers `@kernhq/kernel@^0.9.0`) resolved a **second** kernel next to the one the repository
itself declares. Five were in that state: `collab`, `module-tracker`, `module-chat`, `module-mail`
(0.10.0 beside 0.9.1) and `module-quire` (0.10.0 beside 0.9.0). Two copies of the kernel are two
structurally distinct declarations of the same types, which is what makes a consumer report errors
for procedures that exist.

Bumping the range would have closed those five and re-opened the class at the next kernel minor;
removing it ends the class. It also stops the churn it caused — three of this package's last four
releases were "Updated dependencies → @kernhq/kernel", published for a dependency it never loaded.
