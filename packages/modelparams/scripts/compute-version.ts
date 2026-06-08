import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAllModels } from "../../../src/data/load.js";
import { loadModelsAtRef, refExists } from "../../../src/data/git-baseline.js";
import { findRemovedParams } from "../../../src/data/removals.js";
import { canonicalCatalog, decideBump, bumpVersion } from "./lib/version.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(here, "..");

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

  const baseRef = resolveBaseRef();
  if (!baseRef) {
    const next = bumpVersion(readPackageVersion(), "patch");
    console.error("No base ref available — treating as patch release.");
    emit("level", "patch");
    emit("next", next);
    return;
  }

  const base = await loadModelsAtRef(baseRef);
  const removals = findRemovedParams(base, current);
  const level = decideBump({
    baseCanon: canonicalCatalog(base),
    currentCanon: canonicalCatalog(current),
    hasRemovals: removals.length > 0,
  });

  if (level === null) {
    console.error(`No semantic catalog changes vs ${baseRef} — skipping publish.`);
    emit("level", "");
    emit("next", "");
    return;
  }

  const next = bumpVersion(readPackageVersion(), level);
  console.error(`Catalog change vs ${baseRef}: bump ${level} → ${next}`);
  emit("level", level);
  emit("next", next);
}

main().catch((err) => {
  console.error("compute-version crashed:", err);
  process.exit(1);
});
