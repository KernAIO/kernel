# @kernhq/tsconfig

The TypeScript settings every Kern repository shares. Each repository is built on its own in CI, so
these live in a package rather than a file at the root of a workspace that only exists during local
development.

```json
{ "extends": "@kernhq/tsconfig/base.json" }
```
