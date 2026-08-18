import { loadAllModels } from "./load.js";
import { loadModelsAtRef, mergeBase, refExists } from "./git-baseline.js";
import { findRemovedParams, type ParamRemoval } from "./removals.js";

const OVERRIDE_LABEL = "allow-param-removal";

function argBase(): string | undefined {
  const eq = process.argv.find((a) => a.startsWith("--base="));
  if (eq) return eq.slice("--base=".length);
  const i = process.argv.indexOf("--base");
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return undefined;
}

interface Baseline {
  /** Commit the current catalog is compared against. */
  commit: string;
  /** How to name that commit in output. */
  label: string;
}

/**
 * Resolve the baseline to diff against, trying the most specific source first.
 *
 * The catalog is compared against the merge base rather than the tip of the
 * base branch: the tip may have moved on since this checkout was built, and
 * anything it gained in the meantime is not something this change removed.
 */
function resolveBaseline(): Baseline | null {
  const githubBase = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : undefined;
  const candidates = [argBase(), process.env.BASE_REF, githubBase, "origin/main", "main"];
  for (const ref of candidates) {
    if (!ref || !refExists(ref)) continue;
    const base = mergeBase(ref);
    if (!base) return { commit: ref, label: ref };
    return { commit: base, label: `${ref} (merge base ${base.slice(0, 7)})` };
  }
  return null;
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
  const baseline = resolveBaseline();
  if (!baseline) {
    console.log("No base ref available to compare against — skipping removal guard.");
    return;
  }

  const [{ models: current }, base] = await Promise.all([
    loadAllModels(),
    loadModelsAtRef(baseline.commit),
  ]);

  const removals = findRemovedParams(base, current);
  if (removals.length === 0) {
    console.log(`OK — no parameters removed vs ${baseline.label}.`);
    return;
  }

  reportRemovals(removals, baseline.label);
  process.exit(1);
}

main().catch((err) => {
  console.error("Removal guard crashed:", err);
  process.exit(2);
});
