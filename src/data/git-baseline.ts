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
