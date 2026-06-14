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
- `loadBaselineWithCache(baselineDir = process.cwd())` memoizes
  `readBaseline` results in the module-level `baselineResultsByDirectory`
  `Map`, keyed by baseline directory. This lets repeated rule `create` calls in
  the same process reuse the same baseline object instead of re-reading from
  disk.
- `resetBaselineCache()` clears `baselineResultsByDirectory`; tests use it to
  force a re-read when baseline files are intentionally changed and between
  lint process boundaries.

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

The repository has no Rust compile-time API. Rust-specific `trybuild` tests are
therefore not applicable to this package; TypeScript compile-time validation is
covered by `make typecheck`.
