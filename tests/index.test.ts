/** @file Tests for the public df12-lints package surface. */

import { describe, expect, it } from "bun:test";

import { oxlintPluginSpecifier } from "../src/index";

describe("oxlintPluginSpecifier", () => {
  it("points consumers at the stable package export", () => {
    expect(oxlintPluginSpecifier).toBe("df12-lints/oxlint-plugin");
  });
});
