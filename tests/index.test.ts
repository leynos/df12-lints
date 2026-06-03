/**
 * @file Tests for the public df12-lints package surface.
 *
 * These tests pin the relationship between the TypeScript package entrypoint,
 * `package.json` scripts, and Makefile wrappers so the documented command
 * surface continues to drive formatting, linting, typechecking, and tests.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { oxlintPluginSpecifier } from "../src/index";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8")) as {
  scripts: {
    lint?: string;
    "lint:markdown"?: string;
    "test:all"?: string;
  };
};
const makefile = readFileSync(path.join(PROJECT_ROOT, "Makefile"), "utf8");

describe("oxlintPluginSpecifier", () => {
  it("points consumers at the stable package export", () => {
    expect(oxlintPluginSpecifier).toBe("df12-lints/oxlint-plugin");
  });
});

describe("repository gate wiring", () => {
  it("runs Markdown linting through the default package lint pipeline", () => {
    const lintScript = packageJson.scripts.lint;
    const markdownLintScript = packageJson.scripts["lint:markdown"];
    const testAllScript = packageJson.scripts["test:all"];
    expect(lintScript).toBeDefined();
    expect(markdownLintScript).toBeDefined();
    expect(testAllScript).toBeDefined();

    const testAllSteps = testAllScript?.split("&&").map((step) => step.trim()) ?? [];

    expect(markdownLintScript).toBe('markdownlint-cli2 "**/*.md"');
    expect(lintScript).toContain("bun run lint:markdown");
    expect(testAllSteps).toContain("bun run lint");
  });

  it("wraps Markdown linting with the dependency-installing Makefile target", () => {
    expect(makefile).toMatch(
      /^markdownlint: build ## Lint Markdown files\n\tbun run lint:markdown$/m,
    );
  });
});
