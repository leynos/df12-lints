/**
 * @file Behavioural tests for the local df12 Oxlint plugin.
 *
 * This suite exercises the plugin through temporary Oxlint workspaces and
 * focused helper tests. It connects the package-level plugin export to the rule
 * implementations, snapshots diagnostics, and verifies baseline cache behaviour.
 */

import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import fc from "fast-check";
import { testInternals } from "../tools/oxlint-plugin-df12/index.js";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const PLUGIN_PATH = path.join(PROJECT_ROOT, "tools/oxlint-plugin-df12/index.js");
const JSDOC_RULES = {
  "df12/require-module-jsdoc": "error",
  "df12/require-private-jsdoc": "error",
  "df12/require-public-jsdoc": "error",
};

/** Creates a temporary plugin fixture workspace. */
function createWorkspace() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "df12-lints-"));
  return {
    cleanup() {
      rmSync(directory, { force: true, recursive: true });
    },
    directory,
  };
}

/** Converts the plugin path to a config-local import specifier. */
function pluginSpecifier(directory) {
  const relativePath = path.relative(directory, PLUGIN_PATH).replaceAll(path.sep, "/");
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}

/** Writes an Oxlint config for a selected rule set. */
function writeConfig({ directory, rules }) {
  const configPath = path.join(directory, ".oxlintrc.json");
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        categories: {
          correctness: "off",
          nursery: "off",
          pedantic: "off",
          perf: "off",
          restriction: "off",
          style: "off",
          suspicious: "off",
        },
        jsPlugins: [pluginSpecifier(directory)],
        rules,
      },
      null,
      2,
    ),
    "utf8",
  );
  return configPath;
}

/** Writes one TypeScript fixture file. */
function writeSource({ directory, name, source }) {
  const filePath = path.join(directory, name);
  writeFileSync(filePath, source, "utf8");
  return filePath;
}

/** Runs Oxlint against a fixture workspace. */
function runOxlint({ configPath, cwd = PROJECT_ROOT, env, filePath, filePaths }) {
  const lintTargets = filePaths ?? [filePath];
  const result = spawnSync(
    "bunx",
    ["oxlint", "-c", configPath, "--format", "unix", ...lintTargets],
    {
      cwd,
      encoding: "utf8",
      env: { ...process.env, ...env },
      timeout: 30_000,
    },
  );
  if (result.error) throw result.error;
  return result;
}

/** Counts diagnostics for one rule id. */
function countRuleFindings(output, ruleId) {
  return output.split("\n").filter((line) => line.includes(ruleId)).length;
}

/** Counts baseline cache debug events in Oxlint stderr output. */
function countBaselineCacheEvents(output, event) {
  return output.split("\n").filter((line) => line.includes(`baseline-cache event=${event}`)).length;
}

/** Replaces fixture-local absolute paths with stable snapshot text. */
function normalizeDiagnostics(output, directory) {
  return output.replaceAll(directory, "<workspace>");
}

/**
 * Creates a temporary fixture workspace, writes an Oxlint config and one
 * TypeScript source file, runs Oxlint, cleans up, and returns the result with
 * workspace-local absolute paths replaced by the stable token `<workspace>`.
 *
 * @param options - Fixture options.
 * @param options.rules - Oxlint rules object passed to `writeConfig`.
 * @param options.name - Fixture filename (e.g. `'foo.ts'`).
 * @param options.source - TypeScript source text to lint.
 * @param options.cwd - Working directory for the Oxlint process.
 * @returns The normalized Oxlint process result.
 */
export function runFixture(options) {
  const { rules, name, source, cwd } = options;
  const workspace = createWorkspace();
  try {
    const configPath = writeConfig({ directory: workspace.directory, rules });
    const filePath = writeSource({ directory: workspace.directory, name, source });
    const result = runOxlint({ configPath, filePath, ...(cwd !== undefined ? { cwd } : {}) });
    return {
      status: result.status,
      stdout: normalizeDiagnostics(result.stdout, workspace.directory),
      stderr: normalizeDiagnostics(result.stderr ?? "", workspace.directory),
    };
  } finally {
    workspace.cleanup();
  }
}

/** Creates an identifier AST node. */
function identifier(name) {
  return { type: "Identifier", name };
}

/** Creates a logical expression AST node. */
function logicalExpression(operator, left = identifier("left"), right = identifier("right")) {
  return { type: "LogicalExpression", operator, left, right };
}

/** Counts expected predicate operators for synthetic AST nodes. */
function expectedPredicateCount(node, options) {
  if (
    !node ||
    ["ArrowFunctionExpression", "FunctionDeclaration", "FunctionExpression"].includes(node.type)
  )
    return 0;
  const ownCount = expectedOwnPredicateCount(node, options);
  return (
    ownCount +
    Object.entries(node).reduce(
      (sum, [key, value]) => sum + expectedNodeValueCount(key, value, options),
      0,
    )
  );
}

/** Counts the current synthetic predicate node. */
function expectedOwnPredicateCount(node, options) {
  const logicalOperatorCount = {
    "&&": 1,
    "||": 1,
    "??": options.includeNullishCoalescing ? 1 : 0,
  };
  if (node.type === "LogicalExpression") return logicalOperatorCount[node.operator] ?? 0;
  if (node.type === "ConditionalExpression") return options.includeTernary ? 1 : 0;
  return 0;
}

/** Counts expected predicate operators inside one AST-like property value. */
function expectedNodeValueCount(key, value, options) {
  if (key === "parent") return 0;
  if (Array.isArray(value)) {
    return value.reduce(
      (sum, child) =>
        sum + (isSyntheticAstNode(child) ? expectedPredicateCount(child, options) : 0),
      0,
    );
  }
  return isSyntheticAstNode(value) ? expectedPredicateCount(value, options) : 0;
}

/** Reports whether a generated value is an AST-like node. */
function isSyntheticAstNode(value) {
  return Boolean(value && typeof value.type === "string");
}

/** Builds a generated synthetic predicate AST. */
function predicateAst(maxDepth = 3) {
  const leaf = fc.record({
    name: fc.string({ minLength: 1, maxLength: 8 }),
    type: fc.constant("Identifier"),
  });

  return fc.letrec((tie) => ({
    node:
      maxDepth <= 0
        ? leaf
        : fc.oneof(leaf, tie("logical"), tie("conditional"), tie("wrapper"), tie("functionNode")),
    child: maxDepth <= 1 ? leaf : predicateAst(maxDepth - 1),
    logical: fc.record({
      type: fc.constant("LogicalExpression"),
      operator: fc.constantFrom("&&", "||", "??"),
      left: tie("child"),
      right: tie("child"),
    }),
    conditional: fc.record({
      type: fc.constant("ConditionalExpression"),
      test: tie("child"),
      consequent: tie("child"),
      alternate: tie("child"),
    }),
    wrapper: fc.record({
      type: fc.constant("CallExpression"),
      callee: leaf,
      arguments: fc.array(tie("child"), { minLength: 0, maxLength: 3 }),
    }),
    functionNode: fc.record({
      type: fc.constantFrom("ArrowFunctionExpression", "FunctionDeclaration", "FunctionExpression"),
      body: tie("logical"),
    }),
  })).node;
}

describe("df12/complex-conditional", () => {
  it("counts logical operators in branch predicates without counting nested callback predicates", () => {
    const result = runFixture({
      rules: {
        "df12/complex-conditional": [
          "error",
          { includeNullishCoalescing: false, includeTernary: true, maxLogicalOperators: 1 },
        ],
      },
      name: "complex-conditional.ts",
      source: `
      function checks(a, b, c, items, ready) {
        if (a) {}
        if (a && b) {}
        if (a && b && c) {}
        if ((a || b) && c) {}
        if (items.some((item) => item.ready && item.enabled) && ready) {}
      }
    `,
    });

    expect(result.status).toBe(1);
    expect(countRuleFindings(result.stdout, "df12(complex-conditional)")).toBe(2);
  });

  it("counts ternary roots and nested logical operators when ternaries are included", () => {
    const result = runFixture({
      rules: {
        "df12/complex-conditional": ["error", { includeTernary: true, maxLogicalOperators: 1 }],
      },
      name: "complex-ternary.ts",
      source: `
      const x = a ? (b && c) : d;
    `,
    });

    expect(result.status).toBe(1);
    expect(countRuleFindings(result.stdout, "df12(complex-conditional)")).toBe(1);
  });

  it("does not double-report ternaries used directly as statement tests", () => {
    const result = runFixture({
      name: "direct-test-ternary.ts",
      rules: {
        "df12/complex-conditional": [
          "error",
          {
            includeTernary: true,
            maxLogicalOperators: 1,
          },
        ],
      },
      source: `
          if (a ? (b && c) : d) {}
        `,
    });

    expect(result.status).toBe(1);
    expect(countRuleFindings(result.stdout, "df12(complex-conditional)")).toBe(1);
  });

  it("falls back to the default threshold when maxLogicalOperators is invalid", () => {
    const result = runFixture({
      rules: {
        "df12/complex-conditional": ["error", { maxLogicalOperators: 0 }],
      },
      name: "invalid-threshold.ts",
      source: `
      if (a && b && c) {}
    `,
    });

    expect(result.status).toBe(1);
    expect(countRuleFindings(result.stdout, "df12(complex-conditional)")).toBe(1);
  });

  it("checks while, do-while, and for statement predicates", () => {
    const result = runFixture({
      rules: {
        "df12/complex-conditional": ["error", { maxLogicalOperators: 1 }],
      },
      name: "loop-predicates.ts",
      source: `
      while (a && b && c) {}
      do {} while (d && e && f);
      for (; g && h && i;) {}
    `,
    });

    expect(result.status).toBe(1);
    expect(countRuleFindings(result.stdout, "df12(complex-conditional)")).toBe(3);
  });
});

describe("df12/complex-conditional diagnostics", () => {
  it("checks diagnostic output for a complex conditional", () => {
    const result = runFixture({
      rules: {
        "df12/complex-conditional": ["error", { includeTernary: true, maxLogicalOperators: 1 }],
      },
      name: "diagnostic.ts",
      source: `
      if (a && b && c) {}
    `,
    });
    expect(result.stdout).toMatchSnapshot();
  });
});

describe("df12/complex-conditional properties", () => {
  it("counts generated predicate operators consistently", () => {
    const countedLogicalOperator = fc.constantFrom("&&", "||");
    const valueExpression = fc.record({
      type: fc.constant("Identifier"),
      name: fc.string({ minLength: 1, maxLength: 8 }),
    });
    const logicalExpression = fc.record({
      type: fc.constant("LogicalExpression"),
      operator: countedLogicalOperator,
      left: valueExpression,
      right: valueExpression,
    });
    const conditionalExpression = fc.record({
      type: fc.constant("ConditionalExpression"),
      test: valueExpression,
      consequent: logicalExpression,
      alternate: valueExpression,
    });

    fc.assert(
      fc.property(fc.array(logicalExpression, { minLength: 0, maxLength: 20 }), (expressions) => {
        const body = {
          type: "SequenceExpression",
          expressions,
        };
        expect(testInternals.countPredicateOperators(body, { includeTernary: false })).toBe(
          expressions.length,
        );
      }),
    );

    fc.assert(
      fc.property(conditionalExpression, (expression) => {
        expect(testInternals.countPredicateOperators(expression, { includeTernary: true })).toBe(2);
        expect(testInternals.countPredicateOperators(expression, { includeTernary: false })).toBe(
          1,
        );
      }),
    );
  });

  it("matches generated nested predicate counts for all options", () => {
    const optionsArbitrary = fc.record({
      includeNullishCoalescing: fc.boolean(),
      includeTernary: fc.boolean(),
    });

    fc.assert(
      fc.property(predicateAst(), optionsArbitrary, (node, options) => {
        expect(testInternals.countPredicateOperators(node, options)).toBe(
          expectedPredicateCount(node, options),
        );
      }),
    );
  });
});

describe("df12/export collection properties", () => {
  it("collects local names from generated export declarations", () => {
    const exportName = fc.string({ minLength: 1, maxLength: 8 });
    const exportStatement = exportName.chain((name) =>
      fc.oneof(
        fc.constant({
          specifiers: [{ local: identifier(name) }],
          type: "ExportNamedDeclaration",
        }),
        fc.constant({
          declaration: identifier(name),
          type: "ExportDefaultDeclaration",
        }),
      ),
    );

    fc.assert(
      fc.property(fc.array(exportStatement, { minLength: 0, maxLength: 20 }), (body) => {
        const expected = new Set(
          body.flatMap((statement) =>
            statement.type === "ExportNamedDeclaration"
              ? statement.specifiers.map((specifier) => specifier.local.name)
              : [statement.declaration.name],
          ),
        );
        expect(testInternals.collectExportedNames({ body })).toEqual(expected);
      }),
    );
  });
});

describe("df12/tree traversal helpers", () => {
  it("finds matching descendants while skipping nested function bodies", () => {
    const root = {
      type: "BlockStatement",
      body: [
        logicalExpression("&&"),
        { type: "ArrowFunctionExpression", body: logicalExpression("||") },
      ],
      parent: logicalExpression("??"),
    };

    expect(testInternals.containsNode(root, root, (node) => node.operator === "&&")).toBe(true);
    expect(testInternals.containsNode(root, root, (node) => node.operator === "||")).toBe(false);
    expect(testInternals.containsNode(root, root, (node) => node.operator === "??")).toBe(false);
  });
});

describe("df12 JSDoc rules", () => {
  it("reports module, public function, and private function documentation contract violations", () => {
    const result = runFixture({
      rules: JSDOC_RULES,
      name: "missing-jsdoc.ts",
      source: `
          export function publicApi(value) {
            if (!value) {
              throw new Error('missing');
            }
            return value;
          }

          const privateHelper = () => 'value';

          function reExported(value) {
            return value;
          }

          export { reExported };
        `,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("df12(require-module-jsdoc)");
    expect(result.stdout).toContain("df12(require-public-jsdoc)");
    expect(result.stdout).toContain("df12(require-private-jsdoc)");
  });

  it("accepts supported documented function declaration shapes", () => {
    const result = runFixture({
      rules: JSDOC_RULES,
      name: "documented.ts",
      source: `
          /** @file Documented fixture. */

          /**
           * Reads one public value.
           *
           * @param value Value to read.
           * @returns The original value.
           */
          export function publicApi(value) {
            return value;
          }

          /**
           * Reads one default value.
           *
           * @param value Value to read.
           * @returns The original value.
           */
          export default function defaultApi(value) {
            return value;
          }

          /**
           * Reads one arrow value.
           *
           * @param value Value to read.
           * @returns The original value.
           */
          export const arrowApi = (value) => value;

          /**
           * Raises a documented fixture failure.
           *
           * @throws Always raises a fixture failure.
           */
          export function throwsApi() {
            throw new Error('failure');
          }

          /**
           * Reads a trailing re-exported value.
           *
           * @param value Value to read.
           * @returns The original value.
           */
          function reExported(value) {
            return value;
          }

          /** Builds a private value. */
          function privateHelper() {
            return 'value';
          }

          /** Builds a private arrow value. */
          const privateArrow = () => 'value';

          export { reExported };
        `,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("reports missing JSDoc params for binding patterns", () => {
    const result = runFixture({
      rules: JSDOC_RULES,
      name: "binding-patterns.ts",
      source: `
          /** @file Binding pattern fixture. */

          /**
           * Reads destructured values.
           *
           * @returns A combined value.
           */
          export function patterns({ id, alias: renamed, ...rest }, [first, second], value = 1, ...items) {
            return id + renamed + rest.extra + first + second + value + items.length;
          }
        `,
    });

    expect(result.status).toBe(1);
    expect(countRuleFindings(result.stdout, "df12(require-public-jsdoc)")).toBe(7);
    expect(result.stdout).toContain('parameter "id"');
    expect(result.stdout).toContain('parameter "renamed"');
    expect(result.stdout).toContain('parameter "rest"');
    expect(result.stdout).toContain('parameter "first"');
    expect(result.stdout).toContain('parameter "second"');
    expect(result.stdout).toContain('parameter "value"');
    expect(result.stdout).toContain('parameter "items"');
  });
});

describe("df12 JSDoc default exports", () => {
  it("reports missing JSDoc for default-exported expressions and aliases", () => {
    const expressionResult = runFixture({
      rules: JSDOC_RULES,
      name: "default-expression.ts",
      source: `
          /** @file Default expression fixture. */

          export default (value) => value;
        `,
    });
    const aliasResult = runFixture({
      rules: JSDOC_RULES,
      name: "default-alias.ts",
      source: `
          /** @file Default alias fixture. */

          const defaultAlias = (value) => value;

          export default defaultAlias;
        `,
    });

    expect(
      countRuleFindings(expressionResult.stdout, "df12(require-public-jsdoc)"),
    ).toBeGreaterThan(0);
    expect(countRuleFindings(aliasResult.stdout, "df12(require-public-jsdoc)")).toBeGreaterThan(0);
    expect(aliasResult.stdout).not.toContain("df12(require-private-jsdoc)");
  });
});

describe("df12 JSDoc negative cases", () => {
  it("reports targeted public JSDoc tag omissions", () => {
    const result = runFixture({
      rules: JSDOC_RULES,
      name: "missing-tags.ts",
      source: `
          /** @file Missing tag fixture. */

          /**
           * Reads a value.
           *
           * @returns The original value.
           */
          export function missingParam(value) {
            return value;
          }

          /**
           * Reads a value.
           *
           * @param value Value to read.
           */
          export function missingReturn(value) {
            return value;
          }
        `,
    });

    expect(result.stdout).toContain(
      'Exported function "missingParam" must document parameter "value".',
    );
    expect(result.stdout).toContain(
      'Exported function "missingReturn" must document its return value.',
    );
  });

  it("accepts a documented default-exported alias as public JSDoc", () => {
    const result = runFixture({
      rules: JSDOC_RULES,
      name: "documented-default-alias.ts",
      source: `
          /** @file Documented default alias fixture. */

          /**
           * Reads one default aliased value.
           *
           * @param value Value to read.
           * @returns The original value.
           */
          const defaultAlias = (value) => value;

          export default defaultAlias;
        `,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("reports missing throws and rejects documentation", () => {
    const result = runFixture({
      rules: JSDOC_RULES,
      name: "missing-error-docs.ts",
      source: `
          /** @file Missing error documentation fixture. */

          /**
           * Raises a fixture error.
           */
          export function throwsError() {
            throw new Error('failure');
          }

          /**
           * Rejects a fixture promise.
           *
           * @returns The rejected promise.
           */
          export function rejectsError() {
            return Promise.reject(new Error('failure'));
          }
        `,
    });

    expect(result.status).toBe(1);
    expect(countRuleFindings(result.stdout, "df12(require-public-jsdoc)")).toBe(2);
    expect(result.stdout).toContain(
      'function "throwsError" must document thrown or rejected errors',
    );
    expect(result.stdout).toContain(
      'function "rejectsError" must document thrown or rejected errors',
    );
  });
});

describe("df12 JSDoc baseline", () => {
  it("uses the current baseline file for each lint process", () => {
    testInternals.resetBaselineCache();
    const workspace = createWorkspace();
    try {
      const configPath = writeConfig({
        directory: workspace.directory,
        rules: JSDOC_RULES,
      });
      const filePath = writeSource({
        directory: workspace.directory,
        name: "baseline.ts",
        source: `
          /** @file Baseline fixture. */

          export function skipped(value) {
            return value;
          }
        `,
      });
      const baselinePath = path.join(workspace.directory, ".jsdoc-baseline.json");
      writeFileSync(baselinePath, JSON.stringify({ entries: ["baseline.ts#skipped"] }), "utf8");

      const skippedResult = runOxlint({ configPath, cwd: workspace.directory, filePath });
      writeFileSync(baselinePath, JSON.stringify({ entries: [] }), "utf8");
      const reportedResult = runOxlint({ configPath, cwd: workspace.directory, filePath });

      expect(skippedResult.stdout).not.toContain("df12(require-public-jsdoc)");
      expect(reportedResult.stdout).toContain("df12(require-public-jsdoc)");
    } finally {
      workspace.cleanup();
      testInternals.resetBaselineCache();
    }
  });
});

describe("df12 JSDoc baseline cache behaviour", () => {
  it("reads one baseline across multiple files in a single lint process", () => {
    testInternals.resetBaselineCache();
    const workspace = createWorkspace();
    try {
      const configPath = writeConfig({
        directory: workspace.directory,
        rules: JSDOC_RULES,
      });
      const firstFilePath = writeSource({
        directory: workspace.directory,
        name: "first.ts",
        source: `
          /** @file First baseline fixture. */

          export function first(value) {
            return value;
          }
        `,
      });
      const secondFilePath = writeSource({
        directory: workspace.directory,
        name: "second.ts",
        source: `
          /** @file Second baseline fixture. */

          export function second(value) {
            return value;
          }
        `,
      });
      writeFileSync(
        path.join(workspace.directory, ".jsdoc-baseline.json"),
        JSON.stringify({ entries: ["first.ts#first", "second.ts#second"] }),
        "utf8",
      );

      const result = runOxlint({
        configPath,
        cwd: workspace.directory,
        env: { DF12_LINTS_DEBUG_BASELINE_CACHE: "1" },
        filePaths: [firstFilePath, secondFilePath],
      });

      expect(result.status).toBe(0);
      expect(result.stdout).not.toContain("df12(require-public-jsdoc)");
      expect(countBaselineCacheEvents(result.stderr, "miss")).toBe(1);
      expect(countBaselineCacheEvents(result.stderr, "hit")).toBe(3);
      expect(result.stderr).toContain("hits=3");
      expect(result.stderr).toContain("misses=1");
      expect(result.stderr).toContain("hitRatio=0.75");
    } finally {
      workspace.cleanup();
      testInternals.resetBaselineCache();
    }
  });
});

describe("df12 JSDoc baseline cache process boundaries", () => {
  it("starts each lint process with an empty baseline cache", () => {
    const workspace = createWorkspace();
    try {
      const configPath = writeConfig({
        directory: workspace.directory,
        rules: JSDOC_RULES,
      });
      const filePath = writeSource({
        directory: workspace.directory,
        name: "baseline-process.ts",
        source: `
          /** @file Baseline process fixture. */

          export function skipped(value) {
            return value;
          }
        `,
      });
      const baselinePath = path.join(workspace.directory, ".jsdoc-baseline.json");
      writeFileSync(
        baselinePath,
        JSON.stringify({ entries: ["baseline-process.ts#skipped"] }),
        "utf8",
      );

      const skippedResult = runOxlint({
        configPath,
        cwd: workspace.directory,
        env: { DF12_LINTS_DEBUG_BASELINE_CACHE: "1" },
        filePath,
      });
      writeFileSync(baselinePath, JSON.stringify({ entries: [] }), "utf8");
      const reportedResult = runOxlint({
        configPath,
        cwd: workspace.directory,
        env: { DF12_LINTS_DEBUG_BASELINE_CACHE: "1" },
        filePath,
      });

      expect(skippedResult.stdout).not.toContain("df12(require-public-jsdoc)");
      expect(reportedResult.stdout).toContain("df12(require-public-jsdoc)");
      expect(countBaselineCacheEvents(skippedResult.stderr, "miss")).toBe(1);
      expect(countBaselineCacheEvents(reportedResult.stderr, "miss")).toBe(1);
    } finally {
      workspace.cleanup();
      testInternals.resetBaselineCache();
    }
  });
});

describe("df12 JSDoc baseline errors", () => {
  it("reports invalid baseline JSON and uses an empty baseline", () => {
    // Baseline cache assertions reset around each fixture so tests never rely
    // on state left behind by another workspace.
    testInternals.resetBaselineCache();
    const directory = mkdtempSync(path.join(os.tmpdir(), "df12-lints-"));
    try {
      const baselinePath = path.join(directory, ".jsdoc-baseline.json");
      writeFileSync(baselinePath, "{", "utf8");

      const invalidBaseline = testInternals.loadBaselineWithCache(directory);
      writeFileSync(baselinePath, JSON.stringify({ entries: ["later.ts#value"] }), "utf8");
      testInternals.resetBaselineCache();
      const reloadedBaseline = testInternals.loadBaselineWithCache(directory);

      expect(invalidBaseline.ok).toBe(false);
      expect(invalidBaseline.error).toBeInstanceOf(SyntaxError);
      expect(invalidBaseline.baseline.size).toBe(0);
      expect(reloadedBaseline.ok).toBe(true);
      expect(reloadedBaseline.baseline.size).toBe(1);
    } finally {
      rmSync(directory, { force: true, recursive: true });
      testInternals.resetBaselineCache();
    }
  });

  it("reports invalid baseline JSON through Oxlint diagnostics", () => {
    const workspace = createWorkspace();
    try {
      const configPath = writeConfig({
        directory: workspace.directory,
        rules: {
          "df12/require-private-jsdoc": "error",
          "df12/require-public-jsdoc": "error",
        },
      });
      const filePath = writeSource({
        directory: workspace.directory,
        name: "invalid-baseline.ts",
        source: `
          /** @file Invalid baseline fixture. */

          export function undocumented(value) {
            return value;
          }
        `,
      });
      writeFileSync(path.join(workspace.directory, ".jsdoc-baseline.json"), "{", "utf8");

      const result = runOxlint({
        configPath,
        cwd: workspace.directory,
        env: { DF12_LINTS_DEBUG_BASELINE_CACHE: "1" },
        filePath,
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toContain("Could not load .jsdoc-baseline.json");
      expect(countRuleFindings(result.stdout, "Could not load .jsdoc-baseline.json")).toBe(1);
      expect(result.stdout).toContain("4 problems");
      expect(result.stdout).toContain("df12(require-public-jsdoc)");
      expect(result.stderr).toContain("baseline-cache event=miss");
      expect(result.stderr).toContain("error=");
    } finally {
      workspace.cleanup();
    }
  });

  it("rejects malformed baseline entries with a clear error", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "df12-lints-"));
    try {
      writeFileSync(
        path.join(directory, ".jsdoc-baseline.json"),
        JSON.stringify({ entries: "later.ts#value" }),
        "utf8",
      );

      const result = testInternals.loadBaselineWithCache(directory);

      expect(result.ok).toBe(false);
      expect(result.error).toBeInstanceOf(TypeError);
      expect(result.error.message).toContain("parsed.entries must be an array");
      expect(result.baseline.size).toBe(0);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
