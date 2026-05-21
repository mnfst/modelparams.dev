import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Model } from "../schema/model.js";
import { loadAllModels } from "./load.js";
import { REPO_ROOT } from "./paths.js";
import { findRemovedParams, type ParamRemoval } from "./removals.js";

const OVERRIDE_LABEL = "allow-param-removal";

function git(args: string[]): string {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function refExists(ref: string): boolean {
  try {
    git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function argBase(): string | undefined {
  const eq = process.argv.find((a) => a.startsWith("--base="));
  if (eq) return eq.slice("--base=".length);
  const i = process.argv.indexOf("--base");
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return undefined;
}

/** Resolve the base ref to diff against, trying the most specific source first. */
function resolveBaseRef(): string | null {
  const githubBase = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : undefined;
  const candidates = [argBase(), process.env.BASE_REF, githubBase, "origin/main", "main"];
  for (const ref of candidates) {
    if (ref && refExists(ref)) return ref;
  }
  return null;
}

/** Materialize the `models/` tree at `ref` into a temp dir and load it. */
async function loadModelsAtRef(ref: string): Promise<Model[]> {
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

function reportRemovals(removals: ParamRemoval[], baseRef: string): void {
  console.error(`\n✖ Parameter removal detected vs ${baseRef} — blocked.\n`);
  console.error(
    "Removing a parameter breaks every Manifest user who already has it\n" +
      "configured: they lose the ability to see or change that setting.\n",
  );
  console.error("Parameters present on the base branch but missing in this change:\n");
  let lastModel = "";
  for (const removal of removals) {
    if (removal.modelId !== lastModel) {
      console.error(`  ${removal.modelId}`);
      lastModel = removal.modelId;
    }
    console.error(`    - ${removal.path}`);
  }
  console.error(
    `\nIf this removal is genuinely intended, a maintainer must add the` +
      `\n\`${OVERRIDE_LABEL}\` label to the PR, then re-run this check.\n`,
  );
}

async function main(): Promise<void> {
  const baseRef = resolveBaseRef();
  if (!baseRef) {
    console.log("No base ref available to compare against — skipping removal guard.");
    return;
  }

  const [{ models: current }, base] = await Promise.all([
    loadAllModels(),
    loadModelsAtRef(baseRef),
  ]);

  const removals = findRemovedParams(base, current);
  if (removals.length === 0) {
    console.log(`OK — no parameters removed vs ${baseRef}.`);
    return;
  }

  reportRemovals(removals, baseRef);
  process.exit(1);
}

main().catch((err) => {
  console.error("Removal guard crashed:", err);
  process.exit(2);
});
