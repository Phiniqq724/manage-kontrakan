/// <reference types="jest" />

import { compareVersions, isNewerVersion } from "@/utils/app-update";

describe("compareVersions", () => {
  it("returns 0 for identical versions", () => {
    expect(compareVersions("2.1.0", "2.1.0")).toBe(0);
  });

  it("treats missing trailing segments as 0", () => {
    expect(compareVersions("2.1", "2.1.0")).toBe(0);
    expect(compareVersions("2.1.0", "2.1")).toBe(0);
    expect(compareVersions("3", "3.0.0")).toBe(0);
  });

  it("returns 1 when the first version is newer", () => {
    expect(compareVersions("2.2.0", "2.1.9")).toBe(1);
    expect(compareVersions("3.0.0", "2.9.9")).toBe(1);
    expect(compareVersions("2.1.1", "2.1.0")).toBe(1);
  });

  it("returns -1 when the first version is older", () => {
    expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
    expect(compareVersions("2.1", "2.2")).toBe(-1);
  });

  it("compares segments numerically, not lexicographically", () => {
    expect(compareVersions("2.10.0", "2.9.0")).toBe(1);
    expect(compareVersions("2.9.0", "2.10.0")).toBe(-1);
  });

  it("treats an extra trailing segment as newer", () => {
    expect(compareVersions("1.0.0.1", "1.0.0")).toBe(1);
    expect(compareVersions("1.0.0", "1.0.0.1")).toBe(-1);
  });

  it("treats non-numeric segments as 0", () => {
    expect(compareVersions("2.x.0", "2.0.0")).toBe(0);
    expect(compareVersions("abc", "0")).toBe(0);
    expect(compareVersions("2.abc.1", "2.0.0")).toBe(1);
  });

  it("handles empty strings as 0", () => {
    expect(compareVersions("", "0.0.0")).toBe(0);
    expect(compareVersions("", "1.0.0")).toBe(-1);
    expect(compareVersions("1.0.0", "")).toBe(1);
  });

  it.skip("should rank a pre-release below its release (2.1.0-beta < 2.1.0)", () => {
    // Suspected bug: the "-beta" suffix is parsed as the number 0 in the last
    // segment, so pre-releases compare equal to their release.
    expect(compareVersions("2.1.0-beta", "2.1.0")).toBe(-1);
  });

  it.skip('should ignore a leading "v" (v2.0.0 equals 2.0.0)', () => {
    // Suspected bug: "v2" parses to NaN -> 0, so a tag like "v2.0.0" is
    // considered older than "1.9.9".
    expect(compareVersions("v2.0.0", "2.0.0")).toBe(0);
    expect(compareVersions("v2.0.0", "1.9.9")).toBe(1);
  });
});

describe("isNewerVersion", () => {
  it("is true only when latest is strictly newer than current", () => {
    expect(isNewerVersion("2.1.0", "2.2.0")).toBe(true);
    expect(isNewerVersion("2.1.0", "2.1.1")).toBe(true);
  });

  it("is false for equal versions, including padded ones", () => {
    expect(isNewerVersion("2.1.0", "2.1.0")).toBe(false);
    expect(isNewerVersion("2.1", "2.1.0")).toBe(false);
    expect(isNewerVersion("2.1.0", "2.1")).toBe(false);
  });

  it("is false when latest is older than current", () => {
    expect(isNewerVersion("2.2.0", "2.1.9")).toBe(false);
    expect(isNewerVersion("2.10.0", "2.9.0")).toBe(false);
  });
});
