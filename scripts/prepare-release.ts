/**
 * Prepare a batched release PR for both published packages.
 *
 * Releases used to fire on every push to main, so a day of merged model PRs
 * turned into a dozen npm versions. This script instead accumulates: it asks
 * the existing version classifiers what the *next* version would be given
 * everything on main since the last release tag, writes that version into the
 * package manifests, and prepends a human-readable catalog changelog. The
 * workflow commits the result to a long-lived release branch and opens one
 * `chore: release …` PR. Merging that PR is what publishes.
 *
 * The classifiers stay the single authority on version numbers — this script
 * shells out to them rather than re-deciding anything.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadAllModels } from "../src/data/load.js";
import { loadModelsAtRef, refExists } from "../src/data/git-baseline.js";
import { diffCatalogs, renderCatalogChangelog } from "../src/data/catalog-diff.js";
import { insertChangelogEntry } from "./lib/changelog.js";
import { bumpPackageLockVersion } from "./lib/package-lock.js";
import { bumpUvLockVersion } from "./lib/uv-lock.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface PackageSpec {
  key: "npm" | "python" | "mcp";
  name: string;
  tagPrefix: string;
  /** Version-classifier CLI; emits `next=<version>` (empty when nothing to release). */
  computeScript: string;
  manifestFile: string;
  changelogFile: string;
  readVersion(source: string): string;
  writeVersion(source: string, next: string): string;
  /** Extra files that also record the version and must move with it. */
  syncFiles?: { file: string; write(source: string, next: string): string }[];
  /**
   * Ship at the same version as another package instead of running an own
   * classifier. modelparams-mcp answers from the catalog compiled into its
   * exact-pinned `modelparams` dependency, so "which catalog does version
   * x.y.z carry?" must have one answer.
   */
  lockstepWith?: "npm";
}

const PACKAGES: PackageSpec[] = [
  {
    key: "npm",
    name: "modelparams (npm)",
    tagPrefix: "modelparams@",
    computeScript: "packages/modelparams/scripts/compute-version.ts",
    manifestFile: "packages/modelparams/package.json",
    changelogFile: "packages/modelparams/CHANGELOG.md",
    readVersion: (source) => (JSON.parse(source) as { version: string }).version,
    writeVersion: (source, next) =>
      // Rewrite the single line rather than re-serializing, so the release
      // commit carries no incidental key-order or formatting churn.
      source.replace(/("version"\s*:\s*")\d+\.\d+\.\d+(")/, `$1${next}$2`),
    syncFiles: [
      // package-lock.json records each workspace's own version; without this,
      // every `npm ci` in CI fails on the release PR.
      {
        file: "package-lock.json",
        write: (source, next) => bumpPackageLockVersion(source, next, "modelparams"),
      },
    ],
  },
  {
    key: "mcp",
    name: "modelparams-mcp (npm)",
    tagPrefix: "modelparams-mcp@",
    computeScript: "", // lockstepWith drives the version
    manifestFile: "packages/modelparams-mcp/package.json",
    changelogFile: "packages/modelparams-mcp/CHANGELOG.md",
    lockstepWith: "npm",
    readVersion: (source) => (JSON.parse(source) as { version: string }).version,
    writeVersion: (source, next) =>
      source
        .replace(/("version"\s*:\s*")\d+\.\d+\.\d+(")/, `$1${next}$2`)
        // The exact dependency pin moves with the version (see lockstepWith).
        .replace(/("modelparams"\s*:\s*")[^"]+(")/, `$1${next}$2`),
    syncFiles: [
      // Both the workspace version and the exact `modelparams` pin are
      // mirrored in the lockfile, and `npm ci` checks both.
      {
        file: "package-lock.json",
        write: (source, next) =>
          bumpPackageLockVersion(source, next, "modelparams-mcp", ["modelparams"]),
      },
    ],
  },
  {
    key: "python",
    name: "modelparams (PyPI)",
    tagPrefix: "modelparams-py@",
    computeScript: "packages/modelparams-python/scripts/compute-version.ts",
    manifestFile: "packages/modelparams-python/pyproject.toml",
    changelogFile: "packages/modelparams-python/CHANGELOG.md",
    readVersion: (source) => {
      const match = /^version\s*=\s*"(\d+\.\d+\.\d+)"\s*$/m.exec(source);
      if (!match) throw new Error("could not read project.version from pyproject.toml");
      return match[1]!;
    },
    writeVersion: (source, next) =>
      source.replace(/^(version\s*=\s*")\d+\.\d+\.\d+(")\s*$/m, `$1${next}$2`),
    syncFiles: [
      // uv.lock pins the project's own version; without this, every
      // `uv sync --locked` in CI fails on the release PR.
      { file: "packages/modelparams-python/uv.lock", write: bumpUvLockVersion },
    ],
  },
];

function git(args: string[]): string {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Newest `<prefix>x.y.z` tag, or null before the first release. */
function latestTag(prefix: string): string | null {
  const versions = git(["tag", "--list", `${prefix}*`])
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(prefix))
    .map((tag) => tag.slice(prefix.length))
    .filter((version) => /^\d+\.\d+\.\d+$/.test(version))
    .sort((a, b) => {
      const [al, am, ap] = a.split(".").map(Number);
      const [bl, bm, bp] = b.split(".").map(Number);
      return bl! - al! || bm! - am! || bp! - ap!;
    });
  return versions[0] === undefined ? null : `${prefix}${versions[0]}`;
}

/** Has the MCP server's own source moved since its last published tag? */
function mcpSourceChanged(): boolean {
  const tag = latestTag("modelparams-mcp@");
  if (!tag || !refExists(tag)) return true; // never published -> needs a first release
  return (
    git(["diff", "--name-only", `${tag}..HEAD`, "--", "packages/modelparams-mcp"]).trim() !== ""
  );
}

/** Run a version classifier and read the `next=` line it emits. */
function computeNext(spec: PackageSpec, forceLevel?: string): string {
  const stdout = execFileSync("npx", ["tsx", spec.computeScript], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, FORCE_LEVEL: forceLevel ?? process.env.FORCE_LEVEL ?? "" },
    stdio: ["ignore", "pipe", "inherit"],
  });
  const line = stdout
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith("next="))
    .pop();
  if (line === undefined) {
    throw new Error(`${spec.computeScript} did not emit a next= line`);
  }
  return line.slice("next=".length).trim();
}

function emit(name: string, value: string): void {
  const line = `${name}=${value}\n`;
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, line);
  process.stdout.write(line);
}

interface Prepared {
  spec: PackageSpec;
  from: string | null;
  next: string;
  changelog: string;
}

async function main(): Promise<void> {
  const { models: current, issues } = await loadAllModels();
  if (issues.length > 0) {
    for (const issue of issues) console.error(`${issue.file}: ${issue.message}`);
    throw new Error(`catalog has ${issues.length} validation issue(s); refusing to prepare`);
  }

  const prepared: Prepared[] = [];

  // The catalog classifier only sees model changes. An MCP-only change is
  // still real work that needs shipping, so it forces at least a patch on the
  // npm pair (never on the Python package).
  const mcpForce = mcpSourceChanged() ? "patch" : undefined;

  for (const spec of PACKAGES) {
    const next = spec.lockstepWith
      ? (prepared.find((p) => p.spec.key === spec.lockstepWith)?.next ?? "")
      : computeNext(spec, spec.key === "npm" ? mcpForce : undefined);
    if (next === "") {
      console.error(`${spec.name}: nothing to release.`);
      continue;
    }

    const manifestPath = path.join(REPO_ROOT, spec.manifestFile);
    const source = fs.readFileSync(manifestPath, "utf8");
    const committed = spec.readVersion(source);
    if (committed === next) {
      // The bump is already on main but no tag carries it yet, because the
      // classifier bumps from the newest tag. Either the publish job is still
      // running (it tags last) or it failed. Re-proposing the same version
      // would open a PR duplicating one about to exist, so skip — but say so
      // loudly, since a failed publish otherwise wedges every later release
      // behind a version that never ships.
      console.error(
        `::warning::${spec.name} ${next} is committed on main but not tagged — the publish job is ` +
          `either still running or it failed. Re-run its release workflow (workflow_dispatch) if no ` +
          `release appears; releases stay blocked until ${next} is published.`,
      );
      continue;
    }

    const tag = latestTag(spec.tagPrefix);
    const base = tag && refExists(tag) ? await loadModelsAtRef(tag) : [];
    const changelog = renderCatalogChangelog(diffCatalogs(base, current));

    const updated = spec.writeVersion(source, next);
    if (updated === source) {
      throw new Error(`failed to write version ${next} into ${spec.manifestFile}`);
    }
    fs.writeFileSync(manifestPath, updated, "utf8");
    for (const sync of spec.syncFiles ?? []) {
      const syncPath = path.join(REPO_ROOT, sync.file);
      fs.writeFileSync(syncPath, sync.write(fs.readFileSync(syncPath, "utf8"), next), "utf8");
    }
    const changelogPath = path.join(REPO_ROOT, spec.changelogFile);
    const existingChangelog = fs.existsSync(changelogPath)
      ? fs.readFileSync(changelogPath, "utf8")
      : "# Changelog\n";
    fs.writeFileSync(
      changelogPath,
      insertChangelogEntry(existingChangelog, next, changelog),
      "utf8",
    );

    prepared.push({ spec, from: tag?.slice(spec.tagPrefix.length) ?? null, next, changelog });
    console.error(`${spec.name}: ${committed} -> ${next} (last published: ${tag ?? "none"}).`);
  }

  if (prepared.length === 0) {
    emit("has_changes", "false");
    emit("title", "");
    return;
  }

  const title = `chore: release ${prepared
    .map(({ spec, next }) => `${spec.tagPrefix}${next}`)
    .join(" + ")}`;

  const body = [
    "Batched release prepared by `.github/workflows/release-prepare.yml`.",
    "Merging this PR publishes the packages below; closing it holds them back.",
    "",
    ...prepared.flatMap(({ spec, from, next, changelog }) => [
      `## ${spec.name} — ${from ?? "first release"} → ${next}`,
      "",
      changelog,
      "",
    ]),
  ].join("\n");

  // Written outside the worktree by default so the release commit never picks
  // it up: the workflow stages explicit paths, but a stray untracked file at
  // the repo root is an easy way for that to go wrong later.
  fs.writeFileSync(
    process.env.RELEASE_BODY_PATH ?? path.join(REPO_ROOT, "release-pr-body.md"),
    body,
    "utf8",
  );

  emit("has_changes", "true");
  emit("title", title);
  for (const { spec, next } of prepared) emit(`${spec.key}_next`, next);
}

main().catch((error) => {
  console.error("prepare-release failed:", error);
  process.exit(1);
});
