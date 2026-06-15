import { modelId, type Model } from "../../../../src/schema/model.js";

export type BumpLevel = "major" | "patch";

/**
 * Canonicalize a catalog for value-equality comparison. We sort params by path
 * and drop nothing — any meaningful catalog edit (added/removed param, changed
 * range, new default, edited description) flips the canonical string.
 */
export function canonicalCatalog(models: Model[]): string {
  const sorted = [...models]
    .map((m) => ({
      id: modelId(m),
      provider: m.provider,
      model: m.model,
      authType: m.authType,
      params: [...m.params].sort((a, b) => a.path.localeCompare(b.path)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(sorted);
}

/**
 * Decide whether a catalog change warrants a semver bump.
 *
 * - Any removed parameter (on a still-existing model) → major.
 * - Any other catalog change → patch.
 * - No semantic catalog change → null (skip publish).
 *
 * Adding/removing a whole model is *not* a major change here — that policy
 * matches `findRemovedParams`, which intentionally does not flag whole-model
 * removals (consumers' configured-knob compatibility is the harm we guard
 * against, and dropping a whole model removes the model itself, not a knob).
 */
export function decideBump(input: {
  baseCanon: string;
  currentCanon: string;
  hasRemovals: boolean;
}): BumpLevel | null {
  if (input.hasRemovals) return "major";
  if (input.baseCanon === input.currentCanon) return null;
  return "patch";
}

export function bumpVersion(version: string, level: BumpLevel): string {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`unexpected version "${version}"`);
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]);
  if (level === "major") return `${major + 1}.0.0`;
  return `${major}.${minor}.${patch + 1}`;
}
