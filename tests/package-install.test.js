/**
 * @file Smoke tests for package entry points after a clean install.
 *
 * Two consumer flows are exercised against the tracked working tree:
 *
 * - A Bun git-style install that copies the tree, runs `bun install` so the
 *   `prepare` script builds `dist/`, and imports the package through a symlink.
 * - An `npm pack` flow that builds the publishable tarball and installs it into
 *   a consumer. This is the flow npm uses for both registry and git
 *   dependencies, so it proves the `files` whitelist ships `dist/` even though
 *   `dist/` is git-ignored.
 *
 * Both guard the root `.` export, which previously resolved to ungenerated (or
 * unpacked) build output.
 */

import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const INSTALL_TIMEOUT_MS = 180_000;
const EXPECTED_EXPORTS = {
  pluginName: "df12",
  ruleNames: [
    "complex-conditional",
    "require-module-jsdoc",
    "require-private-jsdoc",
    "require-public-jsdoc",
  ],
  specifier: "df12-lints/oxlint-plugin",
};

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

/** Writes a consumer module that resolves both package exports by name. */
function writeConsumerModule(directory) {
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

/** Runs the consumer module and asserts both exports resolve as expected. */
function expectExportsResolve(consumerPath, consumerDirectory) {
  const consume = run("node", [consumerPath], consumerDirectory);
  expect(consume.stderr).toBe("");
  expect(consume.status).toBe(0);
  expect(JSON.parse(consume.stdout)).toEqual(EXPECTED_EXPORTS);
}

/** Removes the given directories, ignoring missing entries. */
function cleanup(...directories) {
  for (const directory of directories) {
    rmSync(directory, { force: true, recursive: true });
  }
}

describe("package entry points after a clean install", () => {
  it(
    "exposes the root and oxlint-plugin exports to a Bun consumer",
    () => {
      const packageDirectory = mkdtempSync(path.join(os.tmpdir(), "df12-lints-pkg-"));
      const consumerDirectory = mkdtempSync(path.join(os.tmpdir(), "df12-lints-consumer-"));
      try {
        copyTrackedFiles(packageDirectory);
        const install = run("bun", ["install"], packageDirectory);
        expect(install.status).toBe(0);

        mkdirSync(path.join(consumerDirectory, "node_modules"), { recursive: true });
        symlinkSync(
          packageDirectory,
          path.join(consumerDirectory, "node_modules", "df12-lints"),
          "dir",
        );
        const consumerPath = writeConsumerModule(consumerDirectory);
        expectExportsResolve(consumerPath, consumerDirectory);
      } finally {
        cleanup(packageDirectory, consumerDirectory);
      }
    },
    INSTALL_TIMEOUT_MS,
  );

  it(
    "ships dist in the npm pack tarball so the root export resolves",
    () => {
      const packageDirectory = mkdtempSync(path.join(os.tmpdir(), "df12-lints-pack-"));
      const consumerDirectory = mkdtempSync(path.join(os.tmpdir(), "df12-lints-tarball-"));
      try {
        copyTrackedFiles(packageDirectory);
        // Install devDependencies so the `prepare` script's `tsc` is on PATH
        // when `npm pack` builds `dist/`.
        const deps = run("bun", ["install"], packageDirectory);
        expect(deps.status).toBe(0);
        // `npm pack` runs the `prepare` script, building `dist/` before packing.
        const pack = run(
          "npm",
          ["pack", "--json", "--pack-destination", packageDirectory],
          packageDirectory,
        );
        expect(pack.status).toBe(0);
        const [tarball] = JSON.parse(pack.stdout);
        const packedPaths = tarball.files.map((entry) => entry.path);
        // The `files` whitelist must override `.gitignore` for the build output.
        expect(packedPaths).toContain("dist/index.js");
        expect(packedPaths).toContain("dist/index.d.ts");

        writeFileSync(
          path.join(consumerDirectory, "package.json"),
          `${JSON.stringify({ name: "consumer", private: true, version: "1.0.0" }, null, 2)}\n`,
          "utf8",
        );
        const install = run(
          "npm",
          ["install", "--no-audit", "--no-fund", path.join(packageDirectory, tarball.filename)],
          consumerDirectory,
        );
        expect(install.status).toBe(0);

        const consumerPath = writeConsumerModule(consumerDirectory);
        expectExportsResolve(consumerPath, consumerDirectory);
      } finally {
        cleanup(packageDirectory, consumerDirectory);
      }
    },
    INSTALL_TIMEOUT_MS,
  );
});
