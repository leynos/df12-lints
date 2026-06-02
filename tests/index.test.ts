/** @file Tests for the public df12-lints package surface. */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { oxlintPluginSpecifier } from "../src/index";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8"));
const makefile = readFileSync(path.join(PROJECT_ROOT, "Makefile"), "utf8");

describe("oxlintPluginSpecifier", () => {
  it("points consumers at the stable package export", () => {
    expect(oxlintPluginSpecifier).toBe("df12-lints/oxlint-plugin");
  });
});

describe("repository gate wiring", () => {
  it("runs Markdown linting through the default package lint pipeline", () => {
    expect(packageJson.scripts["lint:markdown"]).toBe('markdownlint-cli2 "**/*.md"');
    expect(packageJson.scripts.lint).toContain("bun run lint:markdown");
    expect(packageJson.scripts["test:all"]).toContain("bun run lint");
  });

  it("wraps Markdown linting with the dependency-installing Makefile target", () => {
    expect(makefile).toContain("markdownlint: build ## Lint Markdown files");
    expect(makefile).toContain("bun run lint:markdown");
  });
});
