# Import df12 Oxlint lints from simulacat-core

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

This repository currently contains a minimal TypeScript package skeleton. The
goal of this work is to turn it into the canonical `df12-lints` package by
importing the custom df12 Oxlint rules from
`https://github.com/leynos/simulacat-core` at upstream commit
`af296735bb5d60794a603504fa3629698699ccd5`, preserving their behaviour with
tests, documenting how downstream projects should use them, and tightening the
Biome configuration used by this package.

After the work is complete, a user can install dependencies with `bun install`,
run `make lint`, and have that Makefile target delegate to `package.json`
scripts that run both Biome and Oxlint. The Oxlint run loads the imported df12
plugin and enforces the custom `df12/*` rules. The work is successful only when
`make check-fmt`, `make typecheck`, `make lint`, and `make test` all pass, and
when `coderabbit review --agent` reports no unresolved concerns after each
major milestone.

## Constraints

Follow all repository instructions. The active branch is `import-lints`; do not
work on `main`. There is no in-repository `AGENTS.md` file at the time this plan
is drafted, so the user-provided instructions govern this work.

Use `grepai search --workspace Projects --project $(get-project) ... --toon
--compact` as the primary semantic exploration tool. If the index is empty or
unavailable, fall back to exact file inspection with standard tools. `grepai`
returned no matches for this small repository during planning, so the initial
plan is based on direct inspection after recording that fallback.

Use `leta` for code navigation and refactoring. The workspace was added with:

```bash
leta workspace add /data/leynos/Projects/df12-lints
```

Testing and linting behaviour must be driven by `package.json` scripts and
wrapped by Makefile targets. The Makefile should not contain bespoke command
logic for JavaScript and TypeScript gates where an equivalent package script can
own it.

Run deterministic gates before requesting CodeRabbit. For every major
milestone, run these commands sequentially, logging each with `tee` to a
branch-scoped file under `/tmp`:

```bash
make check-fmt 2>&1 | tee /tmp/check-fmt-df12-lints-import-lints.out
make typecheck 2>&1 | tee /tmp/typecheck-df12-lints-import-lints.out
make lint 2>&1 | tee /tmp/lint-df12-lints-import-lints.out
make test 2>&1 | tee /tmp/test-df12-lints-import-lints.out
```

Only after those four commands pass, run:

```bash
coderabbit review --agent 2>&1 | tee /tmp/coderabbit-df12-lints-import-lints.out
```

Address all applicable CodeRabbit concerns before proceeding to the next major
milestone. Do not use CodeRabbit to find deterministic formatting, linting,
type-checking, or test failures.

Commit after each accepted major milestone. Gate the commit before creating it;
if a post-commit check is needed because hooks or generated files changed, run
the same four Makefile gates again and record the evidence in this plan.

Do not use `/tmp` as a build target. Use it only for logs, temporary source
inspection, or scratch checkouts. Do not kill processes owned by other agents.
Do not create an isolated Cargo cache.

## Tolerances

Stop and ask for direction if the upstream Oxlint plugin API used by
`simulacat-core` is no longer supported by the current `oxlint` package or
requires a rewrite larger than a direct import plus packaging adjustments.

Stop and ask for direction if any milestone requires changing the intended lint
contract, such as weakening the custom rules, removing JSDoc enforcement,
removing `complexity`/`max-depth`, or replacing Oxlint with ESLint.

Stop and ask for direction if `make check-fmt`, `make typecheck`, `make lint`,
or `make test` cannot be made green without changes outside this repository or
without de-scoping requested behaviour.

Stop and ask for direction if `coderabbit review --agent` is unavailable because
of authentication or service errors after deterministic gates pass. Record the
exact failure and continue only after the user decides whether CodeRabbit may be
skipped for that milestone.

Stop and ask for direction if importing the upstream tests requires adding
runtime dependencies that are not already present in `simulacat-core` or are not
directly justified by the lint package. `fast-check`, `oxlint`, and
`markdownlint-cli2` are acceptable because upstream already uses them for these
tooling gates.

## Risks

The upstream plugin is plain JavaScript under `tools/oxlint-plugin-df12`, while
this repository is a TypeScript package skeleton. The likely safe path is to
keep the plugin as JavaScript initially, export it intentionally, and add a
small TypeScript surface only where consumers need package metadata or paths.
Converting the plugin to TypeScript should be deferred unless packaging demands
it.

The upstream tests currently import from
`../tools/oxlint-plugin-df12/index.js` and execute `bunx oxlint` against
temporary fixture workspaces. In this repository, the test paths and package
name should change, but the behaviour assertions should stay close to upstream
so future diffs remain reviewable.

The upstream `simulacat-core` repository has existing source files with lint
debt, baselines, generated schemas, and project-specific docs. This repository
should import the lint package assets, not the application-specific generated
state. `.jsdoc-baseline.json` should remain empty or absent unless this package
has existing documentation debt that cannot be fixed immediately.

Stricter Biome settings may flag the current placeholder `src/index.ts` and
tests. The implementation should replace placeholder code with real package
exports and documentation rather than suppressing violations.

CodeRabbit may report broad design suggestions. Treat concrete correctness,
packaging, testing, documentation, and maintainability findings as required.
Escalate only when a suggestion conflicts with the stated lint contract or would
substantially expand scope beyond the import.

## Progress

- [x] 2026-05-26: Confirmed current branch is `import-lints`.
- [x] 2026-05-26: Confirmed there is no tracked or parent `AGENTS.md` visible
  from `/data/leynos/Projects/df12-lints`; user-provided instructions apply.
- [x] 2026-05-26: Loaded the `execplans` skill and `leta` skill.
- [x] 2026-05-26: Added `/data/leynos/Projects/df12-lints` as a `leta`
  workspace.
- [x] 2026-05-26: Ran `grepai search --workspace Projects --project
  $(get-project) "custom lint rule definitions and tests" --toon --compact`;
  it returned no matches, so planning used exact file inspection.
- [x] 2026-05-26: Cloned `https://github.com/leynos/simulacat-core` to
  `/tmp/simulacat-core-import-lints` for source inspection and recorded HEAD as
  `af296735bb5d60794a603504fa3629698699ccd5`.
- [x] 2026-05-26: Inspected upstream `tools/oxlint-plugin-df12/index.js`,
  `.oxlintrc.json`, `tests/oxlint-plugin.test.js`, `biome.json`,
  `Makefile`, `package.json`, `docs/development.md`, and
  `docs/architecture.md`.
- [x] 2026-05-26: Drafted this ExecPlan at
  `docs/execplans/import-lints.md`.
- [x] 2026-05-26: Ran `make check-fmt`, `make typecheck`, `make lint`, and
  `make test` against the plan-only change; all four gates passed.
- [x] 2026-05-26: Ran `coderabbit review --agent` against the plan-only change.
  The first review raised three minor grammar findings; all were fixed. The
  second review reported zero findings.
- [x] 2026-05-26: Committed the accepted plan-only change as
  `3da0b8c Plan df12 lint import`.
- [x] 2026-05-26: Received explicit user approval to proceed with
  implementation.
- [x] 2026-05-26: Started Milestone 1 and changed plan status to
  `IN PROGRESS`.
- [x] 2026-05-26: Imported upstream
  `tools/oxlint-plugin-df12/index.js`, added `.oxlintrc.json`, updated
  `package.json` scripts and exports, changed the Makefile wrappers to call
  package scripts, replaced the placeholder package export with
  `oxlintPluginSpecifier`, and made existing test/setup files satisfy the
  imported JSDoc rules.
- [x] 2026-05-26: Ran `bun install`; it added `fast-check@4.8.0` and
  `oxlint@1.67.0` to `bun.lock`.
- [x] 2026-05-26: Ran Milestone 1 deterministic gates before this progress
  update. `make check-fmt`, `make typecheck`, `make lint`, and `make test` all
  passed.
- [ ] Rerun Milestone 1 deterministic gates after this progress update.
- [x] 2026-05-26: Ran `coderabbit review --agent` for Milestone 1. It raised
  two applicable plugin concerns: `testInternals` needed explicit public
  documentation, and `maxLogicalOperators` needed validation before use.
- [x] 2026-05-26: Patched `tools/oxlint-plugin-df12/index.js` to document
  `testInternals` and to fall back to `maxLogicalOperators: 1` unless the
  configured value is an integer greater than zero.
- [x] 2026-05-26: The first gate rerun after that patch found that the helper's
  combined predicate violated `df12/complex-conditional`; refactored it into
  guard clauses.
- [x] 2026-05-26: Reran Milestone 1 deterministic gates after CodeRabbit
  fixes. `make check-fmt`, `make typecheck`, `make lint`, and `make test` all
  passed.
- [x] 2026-05-26: Reran `coderabbit review --agent` for Milestone 1 after
  fixes; it reported zero findings.
- [x] 2026-05-26: Milestone 1 passed deterministic gates and CodeRabbit review;
  commit is ready.
- [x] 2026-05-26: Committed Milestone 1 as
  `2eb50b6 Import df12 Oxlint plugin`.
- [x] 2026-05-26: Started Milestone 2 and imported upstream
  `tests/oxlint-plugin.test.js` plus its snapshot into this repository.
- [x] 2026-05-26: Added a local regression test proving invalid
  `maxLogicalOperators` values fall back to the default threshold.
- [x] 2026-05-26: Ran Milestone 2 deterministic gates before this progress
  update. `make check-fmt`, `make typecheck`, `make lint`, and `make test` all
  passed; `make test` ran 17 tests across 2 files with 1 snapshot.
- [ ] Rerun Milestone 2 deterministic gates after this progress update.
- [x] 2026-05-26: Ran `coderabbit review --agent` for Milestone 2. It raised
  two applicable cleanup findings: temporary fixture prefixes still used the
  upstream `simulacat` name, and `runFixture` JSDoc duplicated destructured
  parameter documentation.
- [x] 2026-05-26: Patched `tests/oxlint-plugin.test.js` to use the
  `df12-lints-` temporary directory prefix everywhere and removed the duplicate
  `runFixture` JSDoc parameter entries.
- [x] 2026-05-26: The gate rerun after that patch showed
  `df12/require-public-jsdoc` treats exported destructured parameters as the
  individual bound names. Changed `runFixture` to accept `options` and
  destructure inside the function body so the non-duplicated JSDoc matches the
  lint rule.
- [x] 2026-05-26: Reran Milestone 2 deterministic gates after CodeRabbit
  fixes. `make check-fmt`, `make typecheck`, `make lint`, and `make test` all
  passed.
- [x] 2026-05-26: Reran `coderabbit review --agent` for Milestone 2. It raised
  one remaining valid test-isolation finding: the invalid-baseline test needed
  to clear `testInternals` baseline cache in its `finally` block.
- [x] 2026-05-26: Added `testInternals.resetBaselineCache()` to the
  invalid-baseline test cleanup path.
- [x] 2026-05-26: Reran Milestone 2 deterministic gates after the
  test-isolation fix. `make check-fmt`, `make typecheck`, `make lint`, and
  `make test` all passed.
- [x] 2026-05-26: Reran `coderabbit review --agent` for Milestone 2 after the
  test-isolation fix; it reported zero findings.
- [x] 2026-05-26: Milestone 2 passed deterministic gates and CodeRabbit review;
  commit is ready.
- [x] 2026-05-26: Committed Milestone 2 as
  `5655cea Add df12 Oxlint plugin tests`.
- [x] 2026-05-26: Started Milestone 3 and tightened `biome.jsonc` by enabling
  Git VCS metadata, disabling Assist, including `.oxlintrc.json` and
  `tools/**/*`, and enabling `noExcessiveCognitiveComplexity`,
  `noExcessiveLinesPerFunction`, and `useMaxParams` with the planned
  thresholds.
- [x] 2026-05-26: Ran `bun run fmt`; Biome formatted one newly included file.
- [x] 2026-05-26: Ran Milestone 3 deterministic gates before this progress
  update. `make check-fmt`, `make typecheck`, `make lint`, and `make test` all
  passed.
- [x] 2026-05-26: Reran Milestone 3 deterministic gates after this progress
  update. `make check-fmt`, `make typecheck`, `make lint`, and `make test` all
  passed.
- [x] 2026-05-26: Ran `coderabbit review --agent` for Milestone 3; it reported
  zero findings.
- [x] 2026-05-26: Milestone 3 passed deterministic gates and CodeRabbit review;
  commit is ready.
- [x] 2026-05-26: Committed Milestone 3 as
  `70fda6e Tighten Biome lint settings`.
- [x] 2026-05-26: Started Milestone 4 and added `README.md` plus
  `docs/usage.md` covering Makefile gates, package scripts, downstream Oxlint
  configuration, rule behaviour, suppression policy, and JSDoc baseline policy.
- [x] 2026-05-26: Added `lint:markdown` to `package.json`, changed the
  Makefile `markdownlint` target to delegate to `bun run lint:markdown`, and
  added `markdownlint-cli2@0.22.1` to the lockfile with `bun install`.
- [x] 2026-05-26: Ran Milestone 4 deterministic gates before this progress
  update. `make check-fmt`, `make typecheck`, `make lint`, `make test`, and
  `make markdownlint` all passed.
- [ ] Rerun Milestone 4 deterministic gates after this progress update.
- [x] 2026-05-26: Ran `coderabbit review --agent` for Milestone 4. It raised
  two applicable documentation findings: README wording had redundant phrasing,
  and `docs/usage.md` needed a structured rule-reference format.
- [x] 2026-05-26: Removed the redundant README phrasing and reworked every
  `df12/*` rule in `docs/usage.md` with Purpose, Scope and behaviour,
  Configuration, What is allowed, What is denied, and How to fix sections.
- [x] 2026-05-26: Reran Milestone 4 deterministic gates after CodeRabbit
  fixes. `make check-fmt`, `make typecheck`, `make lint`, `make test`, and
  `make markdownlint` all passed.
- [x] 2026-05-26: Reran `coderabbit review --agent` for Milestone 4. It raised
  two remaining documentation polish findings: use `-ize` spelling in a sample
  comment and reduce repetition in the Makefile-to-package-script bullet list.
- [x] 2026-05-26: Updated the usage guide to use concise command mappings and
  changed the sample helper spelling to `normalizeRuleName`.
- [x] 2026-05-26: Reran Milestone 4 deterministic gates after the second
  documentation review fixes. `make check-fmt`, `make typecheck`, `make lint`,
  `make test`, and `make markdownlint` all passed.
- [x] 2026-05-26: Reran `coderabbit review --agent` for Milestone 4. It raised
  one remaining grammar finding in `docs/usage.md`: use "add a complete JSDoc"
  rather than "add complete JSDoc".
- [x] 2026-05-26: Patched the final grammar finding in `docs/usage.md`.
- [x] 2026-05-26: Reran Milestone 4 deterministic gates after the final grammar
  fix. `make check-fmt`, `make typecheck`, `make lint`, `make test`, and
  `make markdownlint` all passed.
- [x] 2026-05-26: Reran `coderabbit review --agent` for Milestone 4 after the
  final grammar fix; it reported zero findings.
- [x] 2026-05-26: Milestone 4 passed deterministic gates, Markdown lint, and
  CodeRabbit review; commit is ready.
- [x] 2026-05-26: Committed Milestone 4 as
  `a2ac94b Document df12 lint package usage`.
- [x] 2026-05-26: Ran the final integration search for placeholder or temporary
  source references. The only `simulacat` and `/tmp/simulacat` references are
  provenance and review notes inside this ExecPlan.
- [x] 2026-05-26: Ran final integration gates. `make check-fmt`,
  `make typecheck`, `make lint`, `make test`, and `make markdownlint` all
  passed.
- [x] 2026-05-26: Ran final `coderabbit review --agent`; it reported zero
  findings.
- [x] 2026-05-26: Marked this ExecPlan complete.
- [x] 2026-06-02: Verified follow-up review findings against the current branch.
  The ExecPlan spelling, Makefile `markdownlint` prerequisite, package lint
  script coverage, Oxlint fixture timeout, and baseline-cache isolation findings
  were all still valid and were fixed.
- [x] 2026-06-02: Verified the broader failed-check report. Added the prescribed
  user and developer guide entrypoints, documented why Rust `trybuild` is not
  applicable, added workflow-contract tests, and refactored JSDoc baseline state
  so rules receive directory-keyed baseline state during `create(context)`.

## Surprises & Discoveries

The current `df12-lints` repository is a minimal scaffold. It contains
`src/index.ts`, `tests/index.test.ts`, `package.json`, `Makefile`,
`biome.jsonc`, `bunfig.toml`, and `tsconfig.json`. There is no `docs/`
directory yet.

The current Makefile partly satisfies the requested shape but needs tightening.
`make lint`, `make typecheck`, and `make test` delegate to package scripts;
`make check-fmt` currently calls `bunx biome check` directly and should be
wrapped through a package script for consistency.

Milestone 1 confirmed that the current `biome.jsonc` `files.includes` list
limits Biome to `src`, `tests`, and selected root config files even when package
scripts pass `.`. The imported Oxlint plugin remains in upstream formatting
style until the stricter Biome milestone decides whether tools are included in
Biome formatting.

The first Milestone 1 CodeRabbit review found two real issues in the upstream
plugin import: `maxLogicalOperators` accepted invalid configured values, and the
exported `testInternals` object lacked public documentation. Both fixes are
local improvements over the pinned upstream source.

Milestone 2 kept the upstream snapshot approach because the diagnostic output
was already normalized to `<workspace>` and passed unchanged after porting. The
test suite now covers the upstream behaviours plus the local option-validation
regression introduced during Milestone 1.

The first Milestone 2 CodeRabbit review found two pieces of source-repository
residue in the ported tests: the temporary directory prefix still used the
`simulacat` project name, and `runFixture` documented destructured parameters
twice. Both were valid porting cleanup issues.

The second Milestone 2 CodeRabbit review found that the invalid-baseline test
left the plugin's process-local baseline cache mutated after completion. The
test now clears the cache in `finally`, after restoring the working directory
and removing the temporary workspace.

Milestone 3 showed that the imported plugin and ported tests already comply
with the stricter Biome complexity limits after `.oxlintrc.json` and
`tools/**/*` were added to `files.includes`. No Biome suppressions were needed.

Milestone 4 confirmed that the existing `.markdownlint-cli2.jsonc` can lint the
new README, usage guide, and ExecPlan without additional ignores or rule
changes.

The first Milestone 4 CodeRabbit review required the rule reference to be more
structured than the initial prose paragraphs. The usage guide now gives each
rule the same operational shape: purpose, scope, configuration, allowed
example, denied example, and fix guidance.

The second Milestone 4 CodeRabbit review was limited to prose polish. The usage
guide now uses compact Makefile-to-package-script mappings and Oxford `-ize`
spelling in the private-helper example.

The final integration search found no placeholder scaffold names such as
`greet`, no template setup text, and no temporary upstream checkout references
outside this ExecPlan's provenance notes.

Upstream `simulacat-core` runs Biome and Oxlint separately: `lint` depends on
`biomejs` and `oxlint`, `biomejs` runs `bun run lint`, and `oxlint` runs
`bunx oxlint .`. For this package, the same split should live in
`package.json` scripts first, with the Makefile delegating to those scripts.

Upstream custom rules are:

- `df12/complex-conditional`, which reports branch predicates with more than
  the configured number of logical operators and can count ternaries while
  excluding nullish coalescing by default.
- `df12/require-module-jsdoc`, which requires JS/TS files to start with a
  module-level JSDoc block containing `@file`.
- `df12/require-public-jsdoc`, which requires exported functions to have a
  usage-oriented description, parameter tags, return documentation, and
  thrown/rejected error documentation where applicable.
- `df12/require-private-jsdoc`, which requires private top-level functions to
  have a concise one-line JSDoc summary.

Upstream also enables Oxlint's built-in `complexity` rule at max 8 with the
`classic` variant and `max-depth` at max 3.

## Decision Log

2026-05-26: Keep the initial work in draft-plan phase. The `execplans` skill
requires explicit approval before implementation, so this plan describes the
full import but does not begin code movement until the user approves.

2026-05-26: Use upstream commit
`af296735bb5d60794a603504fa3629698699ccd5` as the source reference. This makes
the import auditable and avoids silently tracking a moving upstream branch.

2026-05-26: Plan to preserve the Oxlint plugin as JavaScript for the import.
The upstream file already uses ESM syntax and the Oxlint JavaScript plugin API;
keeping it close to source reduces behaviour drift and makes tests easier to
compare with upstream.

2026-05-26: Plan to move gate command ownership into `package.json`, with
Makefile targets as wrappers. This directly implements the user's requirement
and matches the current pattern in this repository, where most Makefile targets
already delegate to Bun scripts.

2026-05-26: Expose the plugin through the package export
`df12-lints/oxlint-plugin` and expose that stable specifier from
`src/index.ts`. This avoids making consumers depend on an accidental internal
file path while still allowing Oxlint to load the JavaScript plugin file.

2026-05-26: Diverged from the exact upstream plugin source to validate
`maxLogicalOperators` and document `testInternals`. The changes preserve the
rule contract while addressing correctness and maintainability findings from
CodeRabbit.

2026-05-26: Preserve the existing formatter style choices in `biome.jsonc` for
Milestone 3 and limit the change to stricter lint coverage plus Assist/VCS
metadata. This activates the planned code-quality contract without mixing in an
unrelated quote-style or line-width migration.

## Implementation Plan

### Milestone 0: Accept the plan

Review this file and revise it until it captures the desired scope. Do not
start implementation until the user explicitly approves the plan.

Validation for this milestone is plan-only:

```bash
make check-fmt 2>&1 | tee /tmp/check-fmt-df12-lints-import-lints.out
make typecheck 2>&1 | tee /tmp/typecheck-df12-lints-import-lints.out
make lint 2>&1 | tee /tmp/lint-df12-lints-import-lints.out
make test 2>&1 | tee /tmp/test-df12-lints-import-lints.out
coderabbit review --agent 2>&1 | tee /tmp/coderabbit-df12-lints-import-lints.out
git status --short
git add docs/execplans/import-lints.md
git commit -m "Plan df12 lint import"
```

Expected result: all four Makefile gates pass, CodeRabbit has no applicable
concerns, `git status --short` shows only the plan file before staging, and the
commit records the draft plan.

### Milestone 1: Import the Oxlint plugin and package scripts

Add the upstream plugin at `tools/oxlint-plugin-df12/index.js`. Preserve the
rule names and diagnostic messages unless a test proves an adaptation is
required for this package.

Add `.oxlintrc.json` with the upstream custom plugin configuration, adjusted
for this repository's file tree. At a minimum it should load
`./tools/oxlint-plugin-df12/index.js`, ignore `dist/**` and `node_modules/**`,
disable broad Oxlint categories that are not part of this contract, and enable
these rules:

```json
{
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
```

Update `package.json` so scripts own every deterministic gate:

```json
{
  "scripts": {
    "build": "tsc",
    "fmt": "bunx @biomejs/biome format --write .",
    "check:fmt": "bunx @biomejs/biome check --linter-enabled=false --assist-enabled=false .",
    "lint": "bun run lint:biome && bun run lint:oxlint",
    "lint:biome": "bunx @biomejs/biome lint .",
    "lint:oxlint": "bunx oxlint .",
    "check:types": "tsc --noEmit",
    "test": "bun test"
  }
}
```

Use the currently installed Biome package name style consistently. If the lock
file or current dependency set prefers `bunx biome`, keep that spelling; if
aligning with upstream, use `bunx @biomejs/biome`. The final Makefile must call
`bun run check:fmt`, `bun run check:types`, `bun run lint`, and
`bun run test`.

Add required development dependencies:

```json
{
  "devDependencies": {
    "fast-check": "^4.3.0",
    "oxlint": "^1.66.0"
  }
}
```

Use `bun install` to update `bun.lock` if dependency changes require it.

Make the package export or document the plugin path intentionally. If npm-style
package consumers are expected to load the plugin by path, add a stable export
for the plugin file in `package.json` rather than leaving it as an accidental
internal path.

Validation:

```bash
make check-fmt 2>&1 | tee /tmp/check-fmt-df12-lints-import-lints.out
make typecheck 2>&1 | tee /tmp/typecheck-df12-lints-import-lints.out
make lint 2>&1 | tee /tmp/lint-df12-lints-import-lints.out
make test 2>&1 | tee /tmp/test-df12-lints-import-lints.out
coderabbit review --agent 2>&1 | tee /tmp/coderabbit-df12-lints-import-lints.out
git status --short
git add package.json bun.lock Makefile .oxlintrc.json tools/oxlint-plugin-df12/index.js src/index.ts
git commit -m "Import df12 Oxlint plugin"
```

Expected result: all gates pass, CodeRabbit has no applicable concerns, and the
commit contains only the plugin import plus package and wrapper changes needed
to run it.

### Milestone 2: Port and adapt the plugin tests

Replace the placeholder `tests/index.test.ts` with meaningful package surface
tests or remove it if the plugin tests cover the package. Import the upstream
`tests/oxlint-plugin.test.js` as `tests/oxlint-plugin.test.js` or convert it to
TypeScript only if that improves local maintainability without changing the
behaviour.

Adapt test paths from `simulacat-core` to this package. The fixture helper
should resolve `PROJECT_ROOT` to this repository root and `PLUGIN_PATH` to
`tools/oxlint-plugin-df12/index.js`. Temporary fixtures should still use
`mkdtempSync` under `os.tmpdir()` and clean themselves up.

Keep behavioural coverage for:

- `df12/complex-conditional` counting logical operators.
- Ternary handling and prevention of double-reporting direct statement-test
  ternaries.
- Snapshot or exact diagnostic coverage for a representative complex
  conditional.
- Property-based predicate counting with `fast-check`.
- Export collection and tree traversal helpers exposed through `testInternals`.
- Module-level JSDoc enforcement.
- Public and private JSDoc enforcement.
- Default exports, re-exports, missing `@param`, missing `@returns`, and
  baseline handling.

If snapshots are retained, generate stable snapshots with paths normalized to
`<workspace>`. If snapshots add more friction than value for this package, use
explicit diagnostic assertions that still prove the same behaviour.

Validation:

```bash
make check-fmt 2>&1 | tee /tmp/check-fmt-df12-lints-import-lints.out
make typecheck 2>&1 | tee /tmp/typecheck-df12-lints-import-lints.out
make lint 2>&1 | tee /tmp/lint-df12-lints-import-lints.out
make test 2>&1 | tee /tmp/test-df12-lints-import-lints.out
coderabbit review --agent 2>&1 | tee /tmp/coderabbit-df12-lints-import-lints.out
git status --short
git add tests package.json bun.lock
git commit -m "Add df12 Oxlint plugin tests"
```

Expected result: tests fail before the plugin exists or when a rule is broken,
then pass with the imported implementation. CodeRabbit has no applicable
concerns before committing.

### Milestone 3: Tighten Biome and make this package satisfy the new gates

Update `biome.jsonc` to the stricter project policy while preserving this
repository's JSON-with-comments format if desired. The target policy should
include:

- Formatter enabled with 2-space indentation, LF line endings, and a deliberate
  line width.
- VCS integration enabled for Git and `.gitignore`.
- Assist disabled unless a package script explicitly runs it.
- `linter.rules.recommended` enabled.
- `complexity.noExcessiveCognitiveComplexity` at max 8.
- `complexity.noExcessiveLinesPerFunction` at max 70.
- `complexity.useMaxParams` at max 4.
- Project-specific allowed exceptions copied only when they apply to this
  package, not wholesale from `simulacat-core`.

Update source and tests to satisfy the stricter Biome and Oxlint gates without
adding avoidable suppressions. Every JS/TS file included in Oxlint should have
module-level `@file` JSDoc. Public exports should have full public JSDoc.
Private top-level helpers should have concise one-line JSDoc.

Validation:

```bash
make check-fmt 2>&1 | tee /tmp/check-fmt-df12-lints-import-lints.out
make typecheck 2>&1 | tee /tmp/typecheck-df12-lints-import-lints.out
make lint 2>&1 | tee /tmp/lint-df12-lints-import-lints.out
make test 2>&1 | tee /tmp/test-df12-lints-import-lints.out
coderabbit review --agent 2>&1 | tee /tmp/coderabbit-df12-lints-import-lints.out
git status --short
git add biome.jsonc src tests tools package.json bun.lock
git commit -m "Tighten Biome lint settings"
```

Expected result: stricter settings are active, the package itself complies, all
gates pass, and CodeRabbit has no applicable concerns.

### Milestone 4: Document consumer usage and maintenance policy

Add documentation under `docs/`, with at least `docs/development.md` or
`docs/usage.md`, explaining:

- The Makefile gate order and the package scripts behind each Makefile target.
- How to run `make check-fmt`, `make typecheck`, `make lint`, and `make test`.
- How downstream projects load the Oxlint plugin.
- The meaning and examples of each `df12/*` rule.
- How to suppress violations when unavoidable, including the requirement for a
  narrow reason.
- Whether `.jsdoc-baseline.json` is supported, and that new code should fix
  documentation rather than expanding the baseline.

Update `README.md` if it exists by then or create one if absent. It should give
new users a short package overview and point to the deeper docs.

Add `markdownlint-cli2` to `devDependencies` if Markdown linting is part of the
repository contract, and expose it through `package.json` plus the Makefile:

```json
{
  "scripts": {
    "lint:markdown": "markdownlint-cli2 \"**/*.md\""
  }
}
```

The Makefile `markdownlint` target should delegate to `bun run lint:markdown`.
Do not add `markdownlint` to `make all` unless the repository convention or user
explicitly requests it.

Validation:

```bash
make check-fmt 2>&1 | tee /tmp/check-fmt-df12-lints-import-lints.out
make typecheck 2>&1 | tee /tmp/typecheck-df12-lints-import-lints.out
make lint 2>&1 | tee /tmp/lint-df12-lints-import-lints.out
make test 2>&1 | tee /tmp/test-df12-lints-import-lints.out
make markdownlint 2>&1 | tee /tmp/markdownlint-df12-lints-import-lints.out
coderabbit review --agent 2>&1 | tee /tmp/coderabbit-df12-lints-import-lints.out
git status --short
git add docs README.md package.json bun.lock Makefile .markdownlint-cli2.jsonc
git commit -m "Document df12 lint package usage"
```

Expected result: documentation explains the package from a fresh clone, all
deterministic gates pass, Markdown lint passes if configured, and CodeRabbit has
no applicable concerns.

### Milestone 5: Final integration pass

Run a final clean integration pass over the branch. Confirm that the Makefile
and package scripts agree, no temporary upstream checkout paths are referenced,
and no placeholder scaffold remains.

Run:

```bash
git status --short
make check-fmt 2>&1 | tee /tmp/check-fmt-df12-lints-import-lints.out
make typecheck 2>&1 | tee /tmp/typecheck-df12-lints-import-lints.out
make lint 2>&1 | tee /tmp/lint-df12-lints-import-lints.out
make test 2>&1 | tee /tmp/test-df12-lints-import-lints.out
make markdownlint 2>&1 | tee /tmp/markdownlint-df12-lints-import-lints.out
coderabbit review --agent 2>&1 | tee /tmp/coderabbit-df12-lints-import-lints.out
git log --oneline --decorate -5
git status --short
```

If any final fixes are needed, make the smallest possible patch, rerun the
affected deterministic gate plus the full four required gates, rerun
CodeRabbit, and commit:

```bash
git add <changed files>
git commit -m "Finalize df12 lint import"
```

Expected result: the working tree is clean, the recent git history shows small
reviewable commits, all gates pass from the Makefile, CodeRabbit has no
applicable concerns, and the package is ready for review.

## Validation Strategy

Every milestone uses the same deterministic gate sequence:

```bash
make check-fmt 2>&1 | tee /tmp/check-fmt-df12-lints-import-lints.out
make typecheck 2>&1 | tee /tmp/typecheck-df12-lints-import-lints.out
make lint 2>&1 | tee /tmp/lint-df12-lints-import-lints.out
make test 2>&1 | tee /tmp/test-df12-lints-import-lints.out
```

The required success signal is a zero exit code for each command. Review the
tail of each `/tmp/*-df12-lints-import-lints.out` file after completion, so
truncated terminal output does not hide failures.

CodeRabbit is requested only after those deterministic gates pass:

```bash
coderabbit review --agent 2>&1 | tee /tmp/coderabbit-df12-lints-import-lints.out
```

The required success signal is no applicable unresolved concern. If CodeRabbit
finds a valid concern, patch it, rerun the deterministic gates, and request
CodeRabbit review again before committing or moving to the next milestone.

## Outcomes & Retrospective

The custom df12 Oxlint rules from `simulacat-core` were imported into
`tools/oxlint-plugin-df12/index.js`, exposed as `df12-lints/oxlint-plugin`,
and wired into `.oxlintrc.json`.

`package.json` owns the JavaScript and TypeScript gate commands. The Makefile
wraps those package scripts for `check-fmt`, `typecheck`, `lint`, `test`, and
`markdownlint`, matching the requested df12 project workflow.

The package now has behavioural coverage for the Oxlint plugin in
`tests/oxlint-plugin.test.js`, including complex conditional diagnostics,
property-based predicate counting, JSDoc rule behaviours, baseline handling, and
the local invalid-`maxLogicalOperators` regression. The snapshot is stable
because fixture paths are normalized to `<workspace>`.

Biome now enforces the stricter complexity contract over source, tests, root
configuration files, `.oxlintrc.json`, and `tools/**/*`. No Biome suppressions
were needed.

Consumer documentation now lives in `README.md` and `docs/usage.md`. It covers
local gates, downstream Oxlint configuration, each `df12/*` rule, suppression
policy, and `.jsdoc-baseline.json` policy.

Final validation passed:

```bash
make check-fmt
make typecheck
make lint
make test
make markdownlint
coderabbit review --agent
```

The final CodeRabbit review reported zero findings.
