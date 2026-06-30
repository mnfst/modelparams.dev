// Per-parameter index: one detail object per unique parameter path, carrying the
// full list of models that expose it (with each model's own type, default, range
// and conditions). Powers the /parameters/<slug> pages and their structured data.
//
// buildGlossary aggregates the same data down to one summary row per path for the
// /glossary hub; this keeps the per-model detail the dedicated pages need.

import { modelLabel, paramLabel, providerLabel } from "./display.js";
import { parameterSlug } from "./urls.js";
import { ParameterGroup, modelId, type Model, type Parameter } from "../schema/model.js";

export interface ParameterUsage {
  id: string;
  provider: string;
  providerName: string;
  modelName: string;
  model: Model;
  param: Parameter;
}

export interface ParameterDetail {
  path: string;
  slug: string;
  label: string;
  group: string;
  description: string;
  types: string[];
  providers: string[];
  modelCount: number;
  usages: ParameterUsage[];
}

interface Bucket {
  path: string;
  group: string;
  labels: Map<string, number>;
  descriptions: Map<string, number>;
  types: Set<string>;
  providers: Set<string>;
  usages: ParameterUsage[];
}

/** Pick the most frequent string, breaking ties toward the more detailed one. */
function mostCommon(counts: Map<string, number>): string {
  return (
    [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0]?.[0] ?? ""
  );
}

function aggregate(models: Model[]): Map<string, Bucket> {
  const acc = new Map<string, Bucket>();
  for (const model of models) {
    for (const param of model.params) {
      let bucket = acc.get(param.path);
      if (!bucket) {
        bucket = {
          path: param.path,
          group: param.group,
          labels: new Map(),
          descriptions: new Map(),
          types: new Set(),
          providers: new Set(),
          usages: [],
        };
        acc.set(param.path, bucket);
      }
      bucket.labels.set(param.label, (bucket.labels.get(param.label) ?? 0) + 1);
      bucket.descriptions.set(
        param.description,
        (bucket.descriptions.get(param.description) ?? 0) + 1,
      );
      bucket.types.add(param.type);
      bucket.providers.add(model.provider);
      bucket.usages.push({
        id: modelId(model),
        provider: model.provider,
        providerName: providerLabel(model.provider),
        modelName: modelLabel(model),
        model,
        param,
      });
    }
  }
  return acc;
}

function toDetail(bucket: Bucket): ParameterDetail {
  const usages = [...bucket.usages].sort(
    (a, b) =>
      a.providerName.localeCompare(b.providerName) || a.modelName.localeCompare(b.modelName),
  );
  return {
    path: bucket.path,
    slug: parameterSlug(bucket.path),
    label: paramLabel(bucket.path, mostCommon(bucket.labels)),
    group: bucket.group,
    description: mostCommon(bucket.descriptions),
    types: [...bucket.types].sort(),
    providers: [...bucket.providers].sort(),
    modelCount: new Set(bucket.usages.map((u) => u.id)).size,
    usages,
  };
}

const GROUP_ORDER = new Map<string, number>(
  ParameterGroup.options.map((group, index) => [group, index]),
);

/**
 * Every unique parameter, ordered by schema group then by how many models expose
 * it (most-supported first) — the same ordering the glossary uses, so the hub and
 * the detail pages agree.
 */
export function buildParameterIndex(models: Model[]): ParameterDetail[] {
  return [...aggregate(models).values()]
    .map(toDetail)
    .sort(
      (a, b) =>
        (GROUP_ORDER.get(a.group) ?? 0) - (GROUP_ORDER.get(b.group) ?? 0) ||
        b.modelCount - a.modelCount ||
        a.path.localeCompare(b.path),
    );
}

/** Models that don't (yet) document a given parameter path, grouped by provider. */
export function modelsWithoutParameter(
  detail: ParameterDetail,
  allModels: Model[],
): { provider: string; providerName: string; models: Model[] }[] {
  const has = new Set(detail.usages.map((u) => u.id));
  const byProvider = new Map<string, Model[]>();
  for (const model of allModels) {
    if (has.has(modelId(model))) continue;
    const list = byProvider.get(model.provider) ?? [];
    list.push(model);
    byProvider.set(model.provider, list);
  }
  return [...byProvider.entries()]
    .map(([provider, models]) => ({
      provider,
      providerName: providerLabel(provider),
      models: models.sort((a, b) => modelLabel(a).localeCompare(modelLabel(b))),
    }))
    .sort((a, b) => a.providerName.localeCompare(b.providerName));
}
