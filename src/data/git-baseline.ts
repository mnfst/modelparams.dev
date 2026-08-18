import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Model } from "../schema/model.js";
import { loadAllModels } from "./load.js";
import { REPO_ROOT } from "./paths.js";

/** Run a git command from the repo root and return its stdout. */
export function git(args: string[]): string {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Return true if `ref` resolves to a commit. */
export function refExists(ref: string): boolean {
  try {
    git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Return the commit `ref` and `HEAD` share, or null when git cannot find one
 * (unrelated histories, or a clone shallow enough to hide it).
 *
 * On a pull request the checkout is GitHub's `refs/pull/N/merge` commit, which
 * is only recomputed when the PR or its base is pushed to. A re-run — or a
 * `labeled` event — therefore compares a merge built against an older base with
 * a freshly fetched base tip, and every parameter the base gained in between
 * reads as a removal. The merge base is the commit the tree in hand was
 * actually built on, so both sides of the diff come from the same snapshot.
 */
export function mergeBase(ref: string): string | null {
  try {
    return git(["merge-base", ref, "HEAD"]).trim() || null;
  } catch {
    return null;
  }
}

/**
 * Materialize the `models/` tree at `ref` into a temp dir and load it. Returns
 * an empty array when `ref` has no catalog (e.g. before the catalog existed).
 */
export async function loadModelsAtRef(ref: string): Promise<Model[]> {
  const listing = git(["ls-tree", "-r", "--name-only", ref, "--", "models"]).trim();
  const files = listing ? listing.split("\n").filter((f) => /\.ya?ml$/i.test(f)) : [];
  if (files.length === 0) return [];

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "mp-baseline-"));
  try {
    for (const file of files) {
      const content = git(["show", `${ref}:${file}`]);
      const dest = path.join(tmp, ...file.split("/"));
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, content, "utf8");
    }
    const { models } = await loadAllModels(path.join(tmp, "models"));
    return models;
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
