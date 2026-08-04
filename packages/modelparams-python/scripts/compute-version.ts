import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadModelsAtRef } from "../../../src/data/git-baseline.js";
import { loadAllModels } from "../../../src/data/load.js";
import { findRemovedParams } from "../../../src/data/removals.js";
import { canonicalCatalog, type BumpLevel } from "../../modelparams/scripts/lib/version.js";
import { compareVersions, decidePythonRelease } from "./lib/version.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = path.resolve(here, "..");
const TAG_PREFIX = "modelparams-py@";

function readLatestTag(): { tag: string; version: string } | null {
  const output = execFileSync("git", ["tag", "--list", `${TAG_PREFIX}*`], {
    encoding: "utf8",
  });
  const versions = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(TAG_PREFIX))
    .map((tag) => ({ tag, version: tag.slice(TAG_PREFIX.length) }))
    .filter(({ version }) => /^\d+\.\d+\.\d+$/.test(version))
    .sort((a, b) => compareVersions(b.version, a.version));
  return versions[0] ?? null;
}

function readSeedVersion(): string {
  const pyproject = fs.readFileSync(path.join(PACKAGE_DIR, "pyproject.toml"), "utf8");
  const match = /^version\s*=\s*"(\d+\.\d+\.\d+)"\s*$/m.exec(pyproject);
  if (!match) throw new Error("could not read project.version from pyproject.toml");
  return match[1]!;
}

function readForcedLevel(): BumpLevel | null {
  const forced = (process.env.FORCE_LEVEL ?? "").trim();
  return forced === "major" || forced === "patch" ? forced : null;
}

function packageChangedSince(ref: string): boolean {
  const result = spawnSync("git", ["diff", "--quiet", `${ref}..HEAD`, "--", PACKAGE_DIR]);
  if (result.status === 0) return false;
  if (result.status === 1) return true;
  throw new Error(result.stderr.toString() || "git diff failed");
}

function emit(name: string, value: string): void {
  const line = `${name}=${value}\n`;
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, line);
  process.stdout.write(line);
}

async function main(): Promise<void> {
  const { models: current, issues } = await loadAllModels();
  if (issues.length > 0) {
    for (const issue of issues) console.error(`${issue.file}: ${issue.message}`);
    throw new Error(`catalog has ${issues.length} validation issue(s)`);
  }

  const latest = readLatestTag();
  let catalogChanged = true;
  let packageChanged = true;
  let hasParamRemovals = false;

  if (latest) {
    const base = await loadModelsAtRef(latest.tag);
    catalogChanged = canonicalCatalog(base) !== canonicalCatalog(current);
    hasParamRemovals = findRemovedParams(base, current).length > 0;
    packageChanged = packageChangedSince(latest.tag);
  }

  const decision = decidePythonRelease({
    seedVersion: readSeedVersion(),
    latestVersion: latest?.version ?? null,
    forcedLevel: readForcedLevel(),
    catalogChanged,
    packageChanged,
    hasParamRemovals,
  });

  if (decision.nextVersion === null) {
    console.error("No Python package or catalog change since the latest Python release.");
    emit("level", "");
    emit("next", "");
    return;
  }

  console.error(
    latest
      ? `Python release: ${latest.version} -> ${decision.nextVersion} (${decision.level})`
      : `First Python release: ${decision.nextVersion}`,
  );
  emit("level", decision.level ?? "patch");
  emit("next", decision.nextVersion);
}

main().catch((error) => {
  console.error("Python version computation failed:", error);
  process.exit(1);
});
