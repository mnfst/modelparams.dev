// Aggregates the per-model parameter data into a single glossary: one entry per
// unique parameter path, grouped by parameter group. Powers the /glossary page
// and its DefinedTermSet structured data.

import { paramGroupLabel, paramLabel } from "./display.js";
import { ParameterGroup, modelId, type Model } from "../schema/model.js";

export interface GlossaryEntry {
  path: string;
  label: string;
  group: string;
  types: string[];
  modelCount: number;
  providers: string[];
  description: string;
}

export interface GlossaryGroup {
  group: string;
  label: string;
  entries: GlossaryEntry[];
}

interface Bucket {
  labels: Map<string, number>;
  descriptions: Map<string, number>;
  group: string;
  types: Set<string>;
  providers: Set<string>;
  models: Set<string>;
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
          labels: new Map(),
          descriptions: new Map(),
          group: param.group,
          types: new Set(),
          providers: new Set(),
          models: new Set(),
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
      bucket.models.add(modelId(model));
    }
  }
  return acc;
}

function toEntry(path: string, bucket: Bucket): GlossaryEntry {
  return {
    path,
    label: paramLabel(path, mostCommon(bucket.labels)),
    group: bucket.group,
    types: [...bucket.types].sort(),
    modelCount: bucket.models.size,
    providers: [...bucket.providers].sort(),
    description: mostCommon(bucket.descriptions),
  };
}

export function buildGlossary(models: Model[]): GlossaryGroup[] {
  const acc = aggregate(models);
  const entries = [...acc.entries()].map(([path, bucket]) => toEntry(path, bucket));

  return ParameterGroup.options
    .map((group) => ({
      group,
      label: paramGroupLabel(group),
      entries: entries
        .filter((entry) => entry.group === group)
        .sort((a, b) => b.modelCount - a.modelCount || a.path.localeCompare(b.path)),
    }))
    .filter((groupItem) => groupItem.entries.length > 0);
}
