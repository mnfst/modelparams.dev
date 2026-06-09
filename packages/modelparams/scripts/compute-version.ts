import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadAllModels } from "../../../src/data/load.js";
import { loadModelsAtRef, refExists } from "../../../src/data/git-baseline.js";
import { findRemovedParams } from "../../../src/data/removals.js";
import { canonicalCatalog, decideBump, bumpVersion, type BumpLevel } from "./lib/version.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(here, "..");
const TAG_PREFIX = "modelparams@";

function resolveBaseRef(): string | null {
  const candidates = [
    process.env.BASE_REF,
    process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : undefined,
    "HEAD~1",
    "origin/main",
    "main",
  ];
  for (const ref of candidates) {
    if (ref && refExists(ref)) return ref;
  }
  return null;
}

function readPackageVersion(): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(PKG_DIR, "package.json"), "utf8")) as {
    version: string;
  };
  return pkg.version;
}

function versionKey(v: string): number {
  const [a, b, c] = v.split(".").map(Number);
  return (a ?? 0) * 1_000_000 + (b ?? 0) * 1_000 + (c ?? 0);
}

/** Latest published version, taken from `modelparams@x.y.z` git tags. null if none. */
function readLatestTagVersion(): string | null {
  let out = "";
  try {
    out = execFileSync("git", ["tag", "--list", `${TAG_PREFIX}*`], { encoding: "utf8" });
  } catch {
    return null;
  }
  const versions = out
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(TAG_PREFIX))
    .map((line) => line.slice(TAG_PREFIX.length))
    .filter((v) => /^\d+\.\d+\.\d+$/.test(v))
    .sort((a, b) => versionKey(b) - versionKey(a));
  return versions[0] ?? null;
}

function readForcedLevel(): BumpLevel | null {
  const forced = (process.env.FORCE_LEVEL ?? "").trim();
  if (forced === "major" || forced === "patch") return forced;
  return null;
}

/** Auto-detect the bump level from the catalog diff against the base ref. */
async function detectLevel(
  current: Awaited<ReturnType<typeof loadAllModels>>["models"],
): Promise<BumpLevel | null> {
  const baseRef = resolveBaseRef();
  if (!baseRef) {
    // No base ref to diff against — treat any run as a patch.
    return "patch";
  }
  const base = await loadModelsAtRef(baseRef);
  const removals = findRemovedParams(base, current);
  return decideBump({
    baseCanon: canonicalCatalog(base),
    currentCanon: canonicalCatalog(current),
    hasRemovals: removals.length > 0,
  });
}

function emit(name: string, value: string): void {
  const target = process.env.GITHUB_OUTPUT;
  const line = `${name}=${value}\n`;
  if (target) {
    fs.appendFileSync(target, line);
  }
  process.stdout.write(line);
}

async function main(): Promise<void> {
  const { models: current, issues } = await loadAllModels();
  if (issues.length > 0) {
    console.error(`Catalog has ${issues.length} validation issue(s); aborting:`);
    for (const i of issues) console.error(`  ${i.file}: ${i.message}`);
    process.exit(1);
  }

  const latestTag = readLatestTagVersion();
  const level = readForcedLevel() ?? (await detectLevel(current));

  // First release ever (no `modelparams@*` tag): publish the version that
  // `package.json` already declares, so v1 matches the committed seed value.
  if (latestTag === null) {
    const next = readPackageVersion();
    console.error(`First release — publishing package.json version ${next}.`);
    emit("level", level ?? "patch");
    emit("next", next);
    return;
  }

  // Subsequent releases bump from the latest published tag (the repo's
  // package.json is not written back, so tags are the source of truth).
  if (level === null) {
    console.error(`No semantic catalog change since ${TAG_PREFIX}${latestTag} — skipping publish.`);
    emit("level", "");
    emit("next", "");
    return;
  }

  const next = bumpVersion(latestTag, level);
  console.error(`Catalog change: bump ${level} from ${latestTag} → ${next}.`);
  emit("level", level);
  emit("next", next);
}

main().catch((err) => {
  console.error("compute-version crashed:", err);
  process.exit(1);
});
