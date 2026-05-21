import type { Catalog, Model } from "../schema/model.js";

const SCHEMA_URL = "https://modelparams.dev/api/v1/schema.json";

export function buildCatalog(models: Model[]): Catalog {
  return {
    $schema: SCHEMA_URL,
    generatedAt: new Date().toISOString(),
    count: models.length,
    models,
  };
}

export interface CapabilityFacet {
  path: string;
  count: number;
}

export function buildCapabilityFacets(models: Model[]): CapabilityFacet[] {
  const counts = new Map<string, number>();
  for (const model of models) {
    const unique = new Set(model.params.map((p) => p.path));
    for (const path of unique) {
      counts.set(path, (counts.get(path) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
}

export function uniqueProviders(models: Model[]): string[] {
  const set = new Set(models.map((m) => m.provider));
  return [...set].sort((a, b) => a.localeCompare(b));
}

export interface ProviderFacet {
  provider: string;
  count: number;
}

export function buildProviderFacets(models: Model[]): ProviderFacet[] {
  const counts = new Map<string, number>();
  for (const model of models) {
    counts.set(model.provider, (counts.get(model.provider) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([provider, count]) => ({ provider, count }))
    .sort((a, b) => b.count - a.count || a.provider.localeCompare(b.provider));
}
