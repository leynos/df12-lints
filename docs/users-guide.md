# df12-lints usage

This package hosts shared df12 lint rules for JavaScript and TypeScript
projects. The main deliverable is an Oxlint plugin exposed as
`df12-lints/oxlint-plugin`.

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

If the baseline file exists but cannot be read or parsed, the JSDoc rules report
a lint diagnostic and continue with an empty baseline. This keeps invalid
configuration visible while still reporting the underlying documentation gaps.
