import { BY_ID, CATALOG, type CatalogEntry } from "./generated/data.js";
import { DEFAULTS } from "./generated/defaults.js";
import { MODEL_IDS, type ModelId, type Provider } from "./generated/model-ids.js";

/**
 * Return the catalog entry for a model id. The returned object includes the
 * provider, authType, and the full list of parameters with their ranges,
 * defaults, enum values, applicability rules, etc.
 *
 * @example
 * const m = getModel("anthropic/claude-haiku-4-5-20251001");
 * m.params.forEach((p) => console.log(p.path, p.type));
 */
export function getModel(id: ModelId): CatalogEntry {
  return BY_ID[id];
}

/**
 * Return the catalog-declared defaults for a model id. Only parameters that
 * declare a `default` in the catalog appear in the returned object.
 *
 * @example
 * const defaults = getDefaults("anthropic/claude-haiku-4-5-20251001");
 * // { max_tokens: 4096, temperature: 1, top_p: 1, top_k: 0, "thinking.type": "disabled", ... }
 */
export function getDefaults<Id extends ModelId>(id: Id): (typeof DEFAULTS)[Id] {
  return DEFAULTS[id];
}

/**
 * List model ids, optionally filtered by provider. Order matches the canonical
 * sort used in the catalog (alphabetical by `provider/model`).
 *
 * @example
 * for (const id of listModels({ provider: "anthropic" })) { ... }
 */
export function listModels(opts: { provider?: Provider } = {}): readonly ModelId[] {
  if (!opts.provider) return MODEL_IDS;
  const prefix = `${opts.provider}/`;
  return MODEL_IDS.filter((id) => id.startsWith(prefix));
}

/**
 * Look up a specific parameter's catalog definition (range, enum values,
 * description, applicability rules). Returns `undefined` if the model doesn't
 * declare that parameter.
 *
 * @example
 * const thinking = getParam("anthropic/claude-haiku-4-5-20251001", "thinking.type");
 * if (thinking?.type === "enum") console.log(thinking.values);
 */
export function getParam(id: ModelId, path: string): CatalogEntry["params"][number] | undefined {
  return BY_ID[id].params.find((p) => p.path === path);
}

/**
 * Iterate every catalog entry. Equivalent to importing `CATALOG` directly but
 * available as a function for callers that prefer not to pull in the runtime
 * data symbol explicitly.
 */
export function listAllModels(): readonly CatalogEntry[] {
  return CATALOG;
}
