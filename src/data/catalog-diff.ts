import { modelId, type Model, type Parameter } from "../schema/model.js";

/** One model whose parameter set changed between two catalog snapshots. */
export interface ModelParamChange {
  id: string;
  added: string[];
  removed: string[];
  /** Params present on both sides whose definition (range, default, …) changed. */
  updated: string[];
}

export interface CatalogDiff {
  addedModels: string[];
  removedModels: string[];
  changedModels: ModelParamChange[];
}

function indexById(models: Model[]): Map<string, Model> {
  return new Map(models.map((model) => [modelId(model), model]));
}

function indexParams(model: Model): Map<string, Parameter> {
  return new Map(model.params.map((param) => [param.path, param]));
}

/**
 * Canonicalize one parameter for value-equality. Mirrors `canonicalCatalog`'s
 * "any edit counts" policy — we compare the whole definition, not a subset, so
 * a changed range or edited description shows up as an update.
 */
function canonicalParam(param: Parameter): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(param).sort(([a], [b]) => a.localeCompare(b))),
  );
}

/**
 * Diff two catalog snapshots into the shape a human reads in a changelog.
 *
 * This is descriptive only — `decideBump` in the version lib remains the single
 * authority on what a change means for the version number.
 */
export function diffCatalogs(base: Model[], current: Model[]): CatalogDiff {
  const baseById = indexById(base);
  const currentById = indexById(current);

  const addedModels = [...currentById.keys()].filter((id) => !baseById.has(id)).sort();
  const removedModels = [...baseById.keys()].filter((id) => !currentById.has(id)).sort();

  const changedModels: ModelParamChange[] = [];
  for (const [id, currentModel] of [...currentById].sort(([a], [b]) => a.localeCompare(b))) {
    const baseModel = baseById.get(id);
    if (!baseModel) continue; // reported under addedModels

    const baseParams = indexParams(baseModel);
    const currentParams = indexParams(currentModel);

    const added = [...currentParams.keys()].filter((path) => !baseParams.has(path)).sort();
    const removed = [...baseParams.keys()].filter((path) => !currentParams.has(path)).sort();
    const updated = [...currentParams.keys()]
      .filter((path) => {
        const before = baseParams.get(path);
        return (
          before !== undefined &&
          canonicalParam(before) !== canonicalParam(currentParams.get(path)!)
        );
      })
      .sort();

    if (added.length || removed.length || updated.length) {
      changedModels.push({ id, added, removed, updated });
    }
  }

  return { addedModels, removedModels, changedModels };
}

export function isEmptyDiff(diff: CatalogDiff): boolean {
  return (
    diff.addedModels.length === 0 &&
    diff.removedModels.length === 0 &&
    diff.changedModels.length === 0
  );
}

function bullet(label: string, paths: string[]): string {
  return `${label} ${paths.map((path) => `\`${path}\``).join(", ")}`;
}

/**
 * Render a catalog diff as the body of one CHANGELOG entry. Returns a
 * placeholder line for an empty diff so a package-only release still says
 * something, rather than shipping a blank section.
 */
export function renderCatalogChangelog(diff: CatalogDiff): string {
  if (isEmptyDiff(diff)) return "- No catalog changes (package-only release).";

  const lines: string[] = [];

  if (diff.addedModels.length > 0) {
    lines.push("### Models added", "");
    for (const id of diff.addedModels) lines.push(`- \`${id}\``);
    lines.push("");
  }

  if (diff.removedModels.length > 0) {
    lines.push("### Models removed", "");
    for (const id of diff.removedModels) lines.push(`- \`${id}\``);
    lines.push("");
  }

  if (diff.changedModels.length > 0) {
    lines.push("### Parameters changed", "");
    for (const change of diff.changedModels) {
      const parts: string[] = [];
      if (change.added.length > 0) parts.push(bullet("added", change.added));
      if (change.removed.length > 0) parts.push(bullet("removed", change.removed));
      if (change.updated.length > 0) parts.push(bullet("updated", change.updated));
      lines.push(`- \`${change.id}\`: ${parts.join("; ")}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
