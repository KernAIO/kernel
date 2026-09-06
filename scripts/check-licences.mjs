#!/usr/bin/env node
/**
 * Hold every package's README to the licence its package.json declares.
 *
 * This repository is the Apache-2.0 half of Kern, and that split is the whole reason a third party
 * can write a module that is not open source. The claim only does its job where an author reads it,
 * and an author reads npm — which renders the README under a licence badge taken from
 * `package.json`. On 2026-09-06 those two disagreed on **five** published packages: `kernel`,
 * `contracts`, `sdk`, `ui` and `testing` each declared `"license": "Apache-2.0"` and said
 * "License: AGPL-3.0" in the prose directly beneath the badge saying otherwise.
 *
 * Nothing could have caught it. The licence text is right (the repo LICENSE is Apache-2.0), the
 * metadata is right, and no test reads prose — so the only wrong copy was the one a stranger
 * actually reads, and the mistake is invisible from inside the repository. A permissive licence
 * nobody believes is not a permissive licence, which is the same failure this project already
 * recorded when the template was `private: true`: licensed permissively, unreachable in practice.
 *
 * So: if a README names a licence at all, it must name the one the package declares.
 */
import { globSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const SPDX = /\b(AGPL-3\.0(?:-only|-or-later)?|Apache-2\.0|MIT|GPL-3\.0(?:-only|-or-later)?|BSD-3-Clause)\b/gi

const manifests = globSync('packages/*/package.json', { cwd: process.cwd() })
if (manifests.length === 0) {
  console.error('check-licences: no packages/*/package.json found — run me from the repo root')
  process.exit(2)
}

const problems = []
for (const manifest of manifests.sort()) {
  const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
  const declared = pkg.license
  if (!declared) {
    problems.push(`${pkg.name}: package.json declares no "license"`)
    continue
  }

  let readme
  try {
    readme = readFileSync(join(dirname(manifest), 'README.md'), 'utf8')
  } catch {
    continue // a package without a README claims nothing, which is not this check's business
  }

  // The rule is "must name its own licence", not "must name no other". These READMEs contrast the
  // permissive framework with the AGPL product on purpose, and that sentence is the most useful
  // one on the page — a check that forbade it would be pushing the text back toward saying less.
  // Naming the declared licence is also exactly what the original defect failed to do: those five
  // READMEs named AGPL-3.0 and never Apache-2.0 at all.
  const named = [...new Set((readme.match(SPDX) ?? []).map((s) => s.toUpperCase()))]
  if (named.length === 0) continue

  if (!named.includes(declared.toUpperCase())) {
    problems.push(
      `${pkg.name}: package.json says ${declared}, README names only ${named.join(', ')}. ` +
        `npm renders that README under a badge reading ${declared}, so the page contradicts ` +
        `itself for anyone deciding what they may build on this.`,
    )
  }
}

if (problems.length > 0) {
  console.error('Licence claims disagree with the packages that make them:\n')
  for (const p of problems) console.error(`  - ${p}`)
  console.error('\nFix the README, or the package.json if the README is the one that is right.')
  process.exit(1)
}

console.log(`check-licences: ${manifests.length} packages, every README agrees with its manifest`)
