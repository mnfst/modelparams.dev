import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bumpUvLockVersion } from "../scripts/lib/uv-lock.js";

describe("bumpUvLockVersion", () => {
  it("rewrites only the root package's version in the real lockfile", () => {
    const lock = fs.readFileSync(
      path.join(__dirname, "../packages/modelparams-python/uv.lock"),
      "utf8",
    );
    const bumped = bumpUvLockVersion(lock, "9.9.9");
    expect(bumped).toContain('name = "modelparams"\nversion = "9.9.9"');
    // Exactly one line differs: no other package's version moves.
    const diff = bumped.split("\n").filter((line, i) => line !== lock.split("\n")[i]);
    expect(diff).toEqual(['version = "9.9.9"']);
  });

  it("throws when the package entry is missing", () => {
    expect(() =>
      bumpUvLockVersion('[[package]]\nname = "other"\nversion = "1.0.0"', "2.0.0"),
    ).toThrow(/could not find/);
  });
});
