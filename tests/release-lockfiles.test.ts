import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bumpPackageLockVersion } from "../scripts/lib/package-lock.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lock = fs.readFileSync(path.join(REPO_ROOT, "package-lock.json"), "utf8");

function entry(source: string, key: string): string {
  const start = source.indexOf(`\n    ${JSON.stringify(`packages/${key}`)}: {`);
  return source.slice(start, source.indexOf("\n    }", start + 1));
}

describe("bumpPackageLockVersion", () => {
  it("moves the workspace version npm ci compares against package.json", () => {
    const updated = bumpPackageLockVersion(lock, "9.9.9", "modelparams");
    expect(entry(updated, "modelparams")).toContain('"version": "9.9.9"');
  });

  it("moves the exact sibling pin the MCP package ships in lockstep", () => {
    const updated = bumpPackageLockVersion(lock, "9.9.9", "modelparams-mcp", ["modelparams"]);
    const mcp = entry(updated, "modelparams-mcp");
    expect(mcp).toContain('"version": "9.9.9"');
    expect(mcp).toContain('"modelparams": "9.9.9"');
  });

  it("leaves every other entry untouched", () => {
    const updated = bumpPackageLockVersion(lock, "9.9.9", "modelparams");
    expect(entry(updated, "modelparams-mcp")).toBe(entry(lock, "modelparams-mcp"));
    expect(updated.length).toBe(lock.length);
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
