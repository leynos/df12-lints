/**
 * @file Smoke tests for package entry points and packaging after a clean install.
 *
 * Two consumer flows are exercised against the tracked working tree:
 *
 * - A Bun git-style install that copies the tree, runs `bun install` so the
 *   `prepare` script builds `dist/`, and imports the package through a symlink.
 * - An `npm pack` flow that builds the publishable tarball, checks the package
 *   contents, and installs it into a consumer. This is the flow npm uses for
 *   both registry and git dependencies, so it proves the `files` whitelist ships
 *   the export targets even though `dist/` is git-ignored.
 *
 * Both guard the root `.` export, which previously resolved to ungenerated (or
 * unpacked) build output.
 */

import { afterAll, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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

let installedDirectory;

/** Returns a clean-install package directory, creating it on first use. */
function installedPackageDirectory() {
  if (installedDirectory) return installedDirectory;
  const directory = mkdtempSync(path.join(os.tmpdir(), "df12-lints-pkg-"));
  copyTrackedFiles(directory);
  const install = run("bun", ["install"], directory);
  expect(install.status).toBe(0);
  installedDirectory = directory;
  return installedDirectory;
}

afterAll(() => {
  if (installedDirectory) rmSync(installedDirectory, { force: true, recursive: true });
});

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

/** Writes a consumer project that resolves the package by name. */
function writeConsumer(directory, packageDirectory) {
  mkdirSync(path.join(directory, "node_modules"), { recursive: true });
  symlinkSync(packageDirectory, path.join(directory, "node_modules", "df12-lints"), "dir");
  return writeConsumerModule(directory);
}

/** Runs the consumer module and asserts both exports resolve as expected. */
function expectExportsResolve(consumerPath, consumerDirectory) {
  const consume = run("node", [consumerPath], consumerDirectory);
  expect(consume.stderr).toBe("");
  expect(consume.status).toBe(0);
  expect(JSON.parse(consume.stdout)).toEqual(EXPECTED_EXPORTS);
}

describe("package entry points after a clean install", () => {
  it(
    "exposes the root and oxlint-plugin exports to consumers",
    () => {
      const consumerDirectory = mkdtempSync(path.join(os.tmpdir(), "df12-lints-tarball-"));
      try {
        const consumerPath = writeConsumerModule(consumerDirectory);
        expectExportsResolve(consumerPath, consumerDirectory);
      } finally {
        rmSync(consumerDirectory, { force: true, recursive: true });
      }
    },
    INSTALL_TIMEOUT_MS,
  );

  it(
    "ships dist in the npm pack tarball so the root export resolves",
    () => {
      const packageDirectory = installedPackageDirectory();
      const consumerDirectory = mkdtempSync(path.join(os.tmpdir(), "df12-lints-tarball-"));
      try {
        const pack = run(
          "npm",
          ["pack", "--json", "--pack-destination", packageDirectory],
          packageDirectory,
        );
        const [tarball] = JSON.parse(pack.stdout);
        expect(pack.status).toBe(0);
        const [tarball] = JSON.parse(pack.stdout);
        const packedPaths = tarball.files.map((entry) => entry.path);
      const requiredPaths = [
        "README.md",
        "docs/users-guide.md",
        "dist/index.d.ts",
        "dist/index.js",
        "package.json",
        "src/index.ts",
        "tools/oxlint-plugin-df12/index.js",
      ];
        for (const required of requiredPaths) {
          expect(packedPaths).toContain(required);
        }
        const excludedPaths = packedPaths.filter(
          (packedPath) => packedPath.startsWith("tests/") || packedPath === "Makefile",
        );
        expect(excludedPaths).toEqual([]);

        const distDirectory = path.join(packageDirectory, "dist");
        expect(readFileSync(path.join(distDirectory, "index.js"), "utf8")).toMatchSnapshot();
        expect(readFileSync(path.join(distDirectory, "index.d.ts"), "utf8")).toMatchSnapshot();

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
        rmSync(consumerDirectory, { force: true, recursive: true });
      }
    },
    INSTALL_TIMEOUT_MS,
  );
});
