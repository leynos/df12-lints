# df12-lints usage

This package hosts shared df12 lint rules for JavaScript and TypeScript
projects. The main deliverable is an Oxlint plugin exposed as
`df12-lints/oxlint-plugin`.

## Installation

`df12-lints` is deliberately unpublished (`"private": true`) and is consumed as
a git dependency pinned to a release tag. Add it to `package.json` with a tag
reference rather than a bare commit SHA:

```json
{
  "devDependencies": {
    "df12-lints": "github:leynos/df12-lints#v0.1.0"
  }
}
```

The package builds its root entry point (`dist/index.js`) during install
through a `prepare` script, so no manual build step is required. npm and Yarn
run a git dependency's `prepare` script automatically. Bun blocks dependency
lifecycle scripts by default; a Bun consumer must allow this build by listing
the package in `trustedDependencies`:

```json
{
  "trustedDependencies": ["df12-lints"]
}
```

The `df12-lints/oxlint-plugin` subpath resolves to committed source and works
even when the `prepare` script has not run.

## Releases

Releases are cut by tagging the repository, for example `v0.1.0`, following
semantic versioning. Consumers upgrade by moving their pinned tag. Release tags
are never rewritten.

If the package later needs semver ranges or changelog-driven upgrades, the
intended path is publishing to a registry and dropping `"private": true`.

## Package exports

The package exposes two entrypoints:

- `df12-lints/oxlint-plugin` — the Oxlint plugin (the main deliverable).
- `df12-lints` — package metadata. The root export provides
  `oxlintPluginSpecifier`, the stable plugin import path, so configuration code
  can reference it without repeating the literal string:

  ```ts
  import { oxlintPluginSpecifier } from "df12-lints";

  // oxlintPluginSpecifier === "df12-lints/oxlint-plugin"
  ```

## Migrating from an in-repo fork

Some df12 projects previously vendored an earlier copy of this Oxlint plugin
inside their own repository, for example under `tools/oxlint-plugin-df12/`.
When replacing that copy with `df12-lints/oxlint-plugin`, check these behaviour
changes before switching the dependency:

- **JSDoc baseline helper shape:** The old fork exposed a test-only
  `testInternals.loadBaseline` helper that returned a `Set` directly. The
  shared package now exposes `testInternals.getOrCacheBaseline`, which returns
  a result object shaped like `{ baseline, ok, error }`; callers that inspect
  internals must read the `baseline` property. Production consumers should not
  depend on `testInternals`.
- **JSDoc baseline read caching:** The shared plugin briefly read
  `.jsdoc-baseline.json` for each rule `create` invocation, which was tracked in
  [#6](https://github.com/leynos/df12-lints/issues/6). Current releases cache
  the baseline result per resolved directory within one lint process, then
  reset that cache between processes or explicit test resets.
- **Baseline key resolution:** Repository-relative baseline keys now resolve
  from `context.cwd`, then `context.getCwd()`, then `process.cwd()`. This is
  more robust when Oxlint is invoked from a subdirectory, but unusual test
  harnesses should pass the expected lint working directory through the Oxlint
  context.
- **Malformed baseline diagnostics:** If `.jsdoc-baseline.json` exists but
  cannot be read or parsed, the JSDoc rules now report
  `Could not load .jsdoc-baseline.json: ...` as an Oxlint diagnostic and
  continue with an empty baseline. A malformed baseline that used to lint
  cleanly must be fixed or removed.
- **`maxLogicalOperators` validation:** The `df12/complex-conditional` option
  now accepts only positive integers. Missing, non-integer, or non-positive
  values fall back to `1`, so configurations that relied on raw unvalidated
  values should be updated explicitly.

The supported install method is the tag-pinned git dependency documented in
[Installation](#installation). Packaging blockers for the root export, license,
distribution model, and packed file list were resolved in issues [#2][issue-2],
[#3][issue-3], [#4][issue-4], and [#5][issue-5].

[issue-2]: https://github.com/leynos/df12-lints/issues/2
[issue-3]: https://github.com/leynos/df12-lints/issues/3
[issue-4]: https://github.com/leynos/df12-lints/issues/4
[issue-5]: https://github.com/leynos/df12-lints/issues/5

## Local gates

Use the Makefile targets in normal development:

```bash
make check-fmt
make typecheck
make lint
make test
```

The Makefile is a wrapper. The command behaviour lives in `package.json`:

- `make check-fmt` -> `bun run check:fmt`
- `make typecheck` -> `bun run check:types`
- `make lint` -> `bun run lint`
- `make test` -> `bun run test`

`bun run lint` runs Biome first, then Oxlint, then Markdown linting:

```bash
bun run lint:biome
bun run lint:oxlint
bun run lint:markdown
```

`make all` runs `build`, `check-fmt`, `lint`, `typecheck`, and `test` in that
order.

## Downstream Oxlint configuration

Load the plugin from the stable package export:

```json
{
  "jsPlugins": ["df12-lints/oxlint-plugin"]
}
```

A downstream project can enable the same df12 rule contract with:

```json
{
  "rules": {
    "complexity": ["error", { "max": 8, "variant": "classic" }],
    "max-depth": ["error", { "max": 3 }],
    "df12/complex-conditional": [
      "error",
      {
        "maxLogicalOperators": 1,
        "includeTernary": true,
        "includeNullishCoalescing": false
      }
    ],
    "df12/require-module-jsdoc": "error",
    "df12/require-public-jsdoc": "error",
    "df12/require-private-jsdoc": "error"
  }
}
```

## Rules

### `df12/complex-conditional`

Purpose: keep branch predicates readable by forcing complex decisions into
named helpers or guard clauses.

Scope and behaviour: the rule checks branch predicates and reports expressions
with more logical operators than the configured threshold. It counts `&&` and
`||`. Ternary predicates are counted by default. Nullish coalescing is counted
only when `includeNullishCoalescing` is enabled.

Configuration:

```json
{
  "df12/complex-conditional": [
    "error",
    {
      "maxLogicalOperators": 1,
      "includeTernary": true,
      "includeNullishCoalescing": false
    }
  ]
}
```

What is allowed:

```ts
if (isReady && hasAccess) {
  runTask();
}
```

What is denied:

```ts
if (isReady && hasAccess && isFresh) {
  runTask();
}
```

How to fix: extract the predicate or split the condition into guard clauses.

```ts
if (canRunTask(input)) {
  runTask();
}
```

### `df12/require-module-jsdoc`

Purpose: make every linted source file state its module role at the top of the
file.

Scope and behaviour: the rule checks JavaScript and TypeScript files included
in the Oxlint run. Each file must start with a JSDoc block containing `@file`.

Configuration:

```json
{
  "df12/require-module-jsdoc": "error"
}
```

What is allowed:

```ts
/** @file Utilities for repository lint configuration. */

export const value = 1;
```

What is denied:

```ts
export const value = 1;
```

How to fix: add a file-level JSDoc block before imports and declarations.

### `df12/require-public-jsdoc`

Purpose: make exported functions usable from documentation and generated API
references without reading their implementations.

Scope and behaviour: the rule checks exported function declarations,
default-exported functions, exported function expressions, and re-exported
local functions. Public JSDoc must include a usage-oriented description,
`@param` entries for named parameters, `@returns` when a value is returned, and
`@throws` or `@rejects` when errors can escape.

Configuration:

```json
{
  "df12/require-public-jsdoc": "error"
}
```

What is allowed:

```ts
/**
 * Formats a rule identifier for display.
 *
 * @param name Rule name without the namespace.
 * @returns A namespaced rule identifier.
 */
export function ruleId(name: string): string {
  return `df12/${name}`;
}
```

What is denied:

```ts
export function ruleId(name: string): string {
  return `df12/${name}`;
}
```

How to fix: add a complete JSDoc to the exported function, including tags for
each parameter and returned or thrown values.

### `df12/require-private-jsdoc`

Purpose: make private top-level helpers scannable without requiring full public
API documentation.

Scope and behaviour: the rule checks private top-level function declarations
and private top-level function variables. Their JSDoc must be one concise
summary line.

Configuration:

```json
{
  "df12/require-private-jsdoc": "error"
}
```

What is allowed:

```ts
/** Normalizes one rule name. */
function normalizeRuleName(name: string): string {
  return name.trim();
}
```

What is denied:

```ts
function normalizeRuleName(name: string): string {
  return name.trim();
}
```

How to fix: add a short one-line JSDoc summary, or export the function and
write the complete public JSDoc contract.

## Suppressions

Prefer refactoring to suppression. When a suppression is unavoidable, include a
short reason that explains why the exception is narrow.

Biome suppression:

```ts
// biome-ignore complexity.useMaxParams: Adapter mirrors the upstream API.
```

Oxlint suppression:

```ts
// oxlint-disable-next-line complexity -- Generated branch table.
```

df12 plugin suppression:

```ts
// oxlint-disable-next-line df12/require-public-jsdoc -- Legacy API is documented elsewhere.
```

## JSDoc baseline

The plugin supports an optional `.jsdoc-baseline.json` file in the lint process
working directory:

```json
{
  "entries": ["src/example.ts#legacyFunction"]
}
```

Baseline entries should only isolate existing documentation debt. New code
should satisfy the JSDoc rules directly, and baseline entries should be removed
when functions are documented.

If the baseline file exists but cannot be read or parsed, the JSDoc rules
report a lint diagnostic and continue with an empty baseline. This keeps
invalid configuration visible while still reporting the underlying
documentation gaps.
