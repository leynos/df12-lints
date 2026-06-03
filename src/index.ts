/**
 * @file Public package metadata for df12 lint tooling.
 *
 * This module is the small TypeScript entrypoint exported by the package root.
 * It gives downstream configuration code a stable way to refer to the bundled
 * Oxlint plugin subpath without duplicating that string in every consumer.
 */

export const oxlintPluginSpecifier = "df12-lints/oxlint-plugin";
