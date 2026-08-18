import { describe, expect, it } from "vitest";
import {
  compareVersions,
  decidePythonRelease,
} from "../packages/modelparams-python/scripts/lib/version.js";

const unchanged = {
  seedVersion: "0.0.1",
  latestVersion: "0.2.3",
  forcedLevel: null,
  catalogChanged: false,
  packageChanged: false,
  hasParamRemovals: false,
} as const;

describe("decidePythonRelease", () => {
  it("uses the seed for the first independent Python release", () => {
    expect(decidePythonRelease({ ...unchanged, latestVersion: null })).toEqual({
      level: "patch",
      nextVersion: "0.0.1",
    });
  });

  it("patches for catalog and Python-only changes", () => {
    expect(decidePythonRelease({ ...unchanged, catalogChanged: true }).nextVersion).toBe("0.2.4");
    expect(decidePythonRelease({ ...unchanged, packageChanged: true }).nextVersion).toBe("0.2.4");
  });

  it("bumps major when an existing model parameter is removed", () => {
    expect(decidePythonRelease({ ...unchanged, hasParamRemovals: true })).toEqual({
      level: "major",
      nextVersion: "1.0.0",
    });
  });

  it("skips when nothing relevant changed", () => {
    expect(decidePythonRelease(unchanged)).toEqual({ level: null, nextVersion: null });
  });

  it("honors a forced release level", () => {
    expect(decidePythonRelease({ ...unchanged, forcedLevel: "patch" })).toEqual({
      level: "patch",
      nextVersion: "0.2.4",
    });
    expect(decidePythonRelease({ ...unchanged, forcedLevel: "major" })).toEqual({
      level: "major",
      nextVersion: "1.0.0",
    });
  });
});

describe("compareVersions", () => {
  it("compares each semantic-version component independently", () => {
    expect(compareVersions("0.1.1001", "0.2.0")).toBeLessThan(0);
    expect(compareVersions("1.0.0", "0.9999.9999")).toBeGreaterThan(0);
    expect(compareVersions("12.34.56", "12.34.56")).toBe(0);
  });
});
