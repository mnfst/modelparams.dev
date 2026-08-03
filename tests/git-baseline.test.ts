import { describe, expect, it } from "vitest";
import { git, mergeBase, refExists } from "../src/data/git-baseline.js";

describe("mergeBase", () => {
  it("resolves a ref that is already an ancestor of HEAD to that ref", () => {
    const head = git(["rev-parse", "HEAD"]).trim();
    expect(mergeBase("HEAD")).toBe(head);
  });

  // Nothing here may assume HEAD has a parent: CI clones shallow, and the
  // guard falls back to the ref itself when git cannot find a merge base.
  it("returns null for a ref git cannot resolve", () => {
    expect(mergeBase("no-such-ref-for-tests")).toBeNull();
  });
});

describe("refExists", () => {
  it("is true for HEAD and false for a made-up ref", () => {
    expect(refExists("HEAD")).toBe(true);
    expect(refExists("no-such-ref-for-tests")).toBe(false);
  });
});
