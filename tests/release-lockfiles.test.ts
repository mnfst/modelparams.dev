import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bumpPackageLockVersion } from "../scripts/lib/package-lock.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lock = fs.readFileSync(path.join(REPO_ROOT, "package-lock.json"), "utf8");

/** The `packages/<key>` entry, and everything in the lockfile that is not it. */
function split(source: string, key: string): { entry: string; rest: string } {
  const start = source.indexOf(`\n    ${JSON.stringify(`packages/${key}`)}: {`);
  const end = source.indexOf("\n    }", start + 1);
  return { entry: source.slice(start, end), rest: source.slice(0, start) + source.slice(end) };
}

describe("bumpPackageLockVersion", () => {
  it("moves the workspace version npm ci compares against package.json", () => {
    const updated = bumpPackageLockVersion(lock, "9.9.9", "modelparams");
    expect(split(updated, "modelparams").entry).toContain('"version": "9.9.9"');
  });

  // No workspace pins a sibling exactly today — modelparams-mcp did until it
  // stopped being published — so this exercises the repinning against a
  // fixture. Keep it: the day another package pins a sibling, a release that
  // moves one and not the other breaks `npm ci` for every job on the PR.
  it("moves an exact sibling pin alongside the version", () => {
    const fixture = [
      "{",
      '  "packages": {',
      '    "packages/pinning-workspace": {',
      '      "version": "0.0.1",',
      '      "dependencies": {',
      '        "modelparams": "0.0.1"',
      "      }",
      "    }",
      "  }",
      "}",
    ].join("\n");

    const updated = bumpPackageLockVersion(fixture, "9.9.9", "pinning-workspace", ["modelparams"]);
    expect(updated).toContain('"version": "9.9.9"');
    expect(updated).toContain('"modelparams": "9.9.9"');
  });

  it("leaves every other entry untouched", () => {
    // Deliberately not a length comparison: the release branch runs this
    // against a lockfile already carrying a longer version than the one under
    // test, so byte counts legitimately differ.
    const updated = bumpPackageLockVersion(lock, "9.9.9", "modelparams");
    expect(split(updated, "modelparams").rest).toBe(split(lock, "modelparams").rest);
  });

  it("is idempotent, so a re-prepared release branch converges", () => {
    const once = bumpPackageLockVersion(lock, "9.9.9", "modelparams");
    expect(bumpPackageLockVersion(once, "9.9.9", "modelparams")).toBe(once);
  });

  it("fails loudly rather than silently skipping an unknown workspace", () => {
    expect(() => bumpPackageLockVersion(lock, "9.9.9", "not-a-workspace")).toThrow(
      /packages\/not-a-workspace/,
    );
    expect(() => bumpPackageLockVersion(lock, "9.9.9", "modelparams", ["not-a-dep"])).toThrow(
      /not-a-dep/,
    );
  });
});
