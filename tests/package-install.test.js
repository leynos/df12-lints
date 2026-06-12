/**
 * @file Smoke test for package entry points after a clean install.
 *
 * The suite copies the tracked working tree into a temporary directory, runs
 * `bun install` there so the `prepare` script builds `dist/`, and then imports
 * both package exports from a consumer project with Node.js. This guards the
 * root `.` export, which previously resolved to ungenerated build output.
 */

import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const INSTALL_TIMEOUT_MS = 180_000;

/** Runs a command synchronously and fails loudly on spawn errors. */
function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: INSTALL_TIMEOUT_MS,
  });
  if (result.error) throw result.error;
  return result;
}

/** Copies the tracked working tree into a pristine package directory. */
function copyTrackedFiles(destination) {
  const listing = run("git", ["ls-files", "-z"], PROJECT_ROOT);
  const trackedFiles = listing.stdout.split("\0").filter(Boolean);
  for (const file of trackedFiles) {
    const target = path.join(destination, file);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(path.join(PROJECT_ROOT, file), target);
  }
}

/** Writes a consumer project that resolves the package by name. */
function writeConsumer(directory, packageDirectory) {
  mkdirSync(path.join(directory, "node_modules"), { recursive: true });
  symlinkSync(packageDirectory, path.join(directory, "node_modules", "df12-lints"), "dir");
  const consumerPath = path.join(directory, "consumer.mjs");
  writeFileSync(
    consumerPath,
    [
      'import { oxlintPluginSpecifier } from "df12-lints";',
      'import plugin from "df12-lints/oxlint-plugin";',
      "console.log(JSON.stringify({",
      "  pluginName: plugin.meta.name,",
      "  ruleNames: Object.keys(plugin.rules).sort(),",
      "  specifier: oxlintPluginSpecifier,",
      "}));",
      "",
    ].join("\n"),
    "utf8",
  );
  return consumerPath;
}

describe("package entry points after a clean install", () => {
  it(
    "exposes the root and oxlint-plugin exports to consumers",
    () => {
      const packageDirectory = mkdtempSync(path.join(os.tmpdir(), "df12-lints-pkg-"));
      const consumerDirectory = mkdtempSync(path.join(os.tmpdir(), "df12-lints-consumer-"));
      try {
        copyTrackedFiles(packageDirectory);
        const install = run("bun", ["install"], packageDirectory);
        expect(install.status).toBe(0);

        const consumerPath = writeConsumer(consumerDirectory, packageDirectory);
        const consume = run("node", [consumerPath], consumerDirectory);

        expect(consume.stderr).toBe("");
        expect(consume.status).toBe(0);
        expect(JSON.parse(consume.stdout)).toEqual({
          pluginName: "df12",
          ruleNames: [
            "complex-conditional",
            "require-module-jsdoc",
            "require-private-jsdoc",
            "require-public-jsdoc",
          ],
          specifier: "df12-lints/oxlint-plugin",
        });
      } finally {
        rmSync(packageDirectory, { force: true, recursive: true });
        rmSync(consumerDirectory, { force: true, recursive: true });
      }
    },
    INSTALL_TIMEOUT_MS,
  );
});
