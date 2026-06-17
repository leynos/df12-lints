# df12-lints developers guide

This guide describes the internal package structure behind the shared df12
lint tooling.

## Package layout

The package exposes two entrypoints:

- [`src/index.ts`](../src/index.ts) exports package metadata for consumers.
- [`tools/oxlint-plugin-df12/index.js`](../tools/oxlint-plugin-df12/index.js)
  exports the Oxlint JavaScript plugin through the `./oxlint-plugin` package
  subpath.

The package entrypoint exposes `oxlintPluginSpecifier` so downstream tooling
can refer to the stable plugin import path without duplicating the literal
specifier.

## Build system

The package root export `.` resolves to `dist/index.js` (types
`dist/index.d.ts`). These files are generated, not committed; `dist/` is
git-ignored.

- [`tsconfig.build.json`](../tsconfig.build.json) drives emission. It extends
  the base config but sets `rootDir` and `include` to `src`, so `tsc` emits
  `dist/index.js`. The base [`tsconfig.json`](../tsconfig.json) also includes
  `tests`; building with it would emit `dist/src/index.js` and miss the path
  named by the export map. The base config is still used for type-checking
  through `make typecheck` (`tsc --noEmit`).
- `bun run build` runs `tsc -p tsconfig.build.json`.
- The `prepare` script runs the same build, so `bun install` and `npm install`
  generate `dist/` automatically. This covers git and registry installs without
  a manual build step. Bun blocks dependency lifecycle scripts by default, so
  Bun consumers of a git install must list `df12-lints` in
  `trustedDependencies` for the `prepare` build to run.
- The `package.json` `files` whitelist ships `dist`, `src`, and
  `tools/oxlint-plugin-df12` in the packed tarball. `files` overrides
  `.gitignore`, which would otherwise drop the generated `dist/` from
  `npm pack` (the flow npm uses for both registry and git dependencies). `src`
  is shipped so the emitted source maps, which reference `../src/index.ts`,
  resolve in consumers.

## Distribution and versioning

`df12-lints` is distributed as a git dependency pinned to release tags. Registry
publishing was deliberately not chosen for the first consumable releases because
this repository does not have publishing credentials or a release pipeline. The
git-only model keeps releases reproducible without requiring each consumer to
track raw commit SHAs.

Keep `"private": true` in `package.json` while this model is in place. The flag
is a guardrail against accidental registry publication, not a statement that the
package cannot be consumed. Consumers install from GitHub with an immutable tag,
for example `github:leynos/df12-lints#v0.1.0`.

Versions follow semantic versioning. Cut a release by tagging the merged commit,
for example `v0.1.0`; do not rewrite release tags after they are pushed.
Consumers upgrade by moving their pinned tag. The `prepare` build and `files`
whitelist are part of this release contract: git installs build `dist/`, and
packed installs include the files named by the package export map.

If consumers later need semver ranges, changelog-driven registry upgrades, or a
non-git package source, add a proper registry release pipeline and publishing
credentials first. Only then remove `"private": true` and publish the package.

## Oxlint plugin internals

The plugin registers four df12 rules:

- `df12/complex-conditional`
- `df12/require-module-jsdoc`
- `df12/require-public-jsdoc`
- `df12/require-private-jsdoc`

The JSDoc rules load `.jsdoc-baseline.json` from the lint working directory.
Baseline loading is split into two stages:

- `readBaseline(baselineDir)` reads and parses
  `<baselineDir>/.jsdoc-baseline.json` without caching, validates `entries` as
  an array, returns `{ baseline, error?, ok }`, and treats missing files as an
  empty baseline.
- `getOrCacheBaseline(baselineDir = process.cwd())` memoizes
  `readBaseline` results in the module-level `baselineResultsByDirectory`
  `Map`, keyed by resolved baseline directory. This lets repeated rule `create`
  calls in the same process reuse the same baseline object instead of
  re-reading from disk. Error results are cached too because a lint run treats
  the baseline file as immutable after the first read.
- `resetBaselineCache()` clears `baselineResultsByDirectory`; tests use it to
  force a re-read when baseline files are intentionally changed and between
  lint process boundaries.

Set `DF12_LINTS_DEBUG_BASELINE_CACHE=1` to emit baseline cache hit, miss,
error, and hit-ratio details to stderr while debugging local lint runs. Normal
lint runs do not emit cache logs.

Baseline state is injected into rule checks when `create(context)` runs, so
test fixtures can supply an explicit directory without mutating `process.cwd()`.

The exported `testInternals` object is test-only surface. It exposes AST helper
functions, baseline loading, and baseline cache reset hooks used by the Bun
behavioural tests. Production consumers should load only
`df12-lints/oxlint-plugin`.

## Development workflow

The Makefile is the stable command surface for local work and CI wrappers:

- `make check-fmt` runs `bun run check:fmt`.
- `make typecheck` runs `bun run check:types`.
- `make lint` runs `bun run lint`.
- `make test` runs `bun run test`.
- `make markdownlint` runs `bun run lint:markdown`.

The package scripts own the actual JavaScript and TypeScript behaviour. Keep
new lint, format, typecheck, and test work wired through `package.json` first,
then wrap it with the Makefile when a stable target is needed.

## Test coverage

The Bun suite covers the package export, Makefile/package script wiring, rule
behaviour, snapshots for multiline diagnostics, property tests for predicate
counting, and baseline-cache regression cases.

[`tests/package-install.test.js`](../tests/package-install.test.js) covers the
distribution surface. It installs the tracked tree two ways — a Bun git-style
install and an `npm pack` tarball install — and imports both exports by package
name from a Node.js consumer. The tarball case also snapshots the compiled
`dist/index.js` and `dist/index.d.ts`, so TypeScript emit drift is caught
alongside the runtime-resolution checks, and asserts the `files` whitelist
keeps `dist/` in the packed artifact.

The repository has no Rust compile-time API. Rust-specific `trybuild` tests are
therefore not applicable to this package; TypeScript compile-time validation is
covered by `make typecheck` and the compiled-output snapshots above.
