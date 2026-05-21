import { modelId, type Model } from "../schema/model.js";

export interface ParamRemoval {
  modelId: string;
  path: string;
}

/**
 * Build an index of `modelId -> set of parameter paths` declared for that model.
 * Paths from duplicate model ids (should not happen in a valid catalog) are
 * unioned so we never under-count what a model exposes.
 */
export function buildParamIndex(models: Model[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const model of models) {
    const id = modelId(model);
    const paths = index.get(id) ?? new Set<string>();
    for (const param of model.params) {
      paths.add(param.path);
    }
    index.set(id, paths);
  }
  return index;
}

/**
 * Find parameters that exist on `base` but are gone on `current`.
 *
 * Scope (intentional): only models that STILL EXIST in `current` are checked.
 * Dropping a whole model (its id no longer appears) is not reported here — that
 * is governed by a separate policy decision. The harm we guard against is a live
 * model silently losing a knob that consumers already have configured.
 */
export function findRemovedParams(base: Model[], current: Model[]): ParamRemoval[] {
  const baseIndex = buildParamIndex(base);
  const currentIndex = buildParamIndex(current);
  const removals: ParamRemoval[] = [];

  for (const [id, basePaths] of baseIndex) {
    const currentPaths = currentIndex.get(id);
    if (!currentPaths) continue; // whole model gone — out of scope by policy
    for (const path of basePaths) {
      if (!currentPaths.has(path)) {
        removals.push({ modelId: id, path });
      }
    }
  }

  removals.sort((a, b) => a.modelId.localeCompare(b.modelId) || a.path.localeCompare(b.path));
  return removals;
}
