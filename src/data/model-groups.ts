import { API_SURFACES } from "./api-surfaces.js";
import type { ProviderFacet } from "./catalog.js";
import type { ApiSurface, Model } from "../schema/model.js";

export interface ModelGroup {
  key: string;
  provider: string;
  model: string;
  variants: Model[];
  apiSurfaces: ApiSurface[];
  capabilities: string[];
  maxParams: number;
}

const surfaceOrder = new Map(API_SURFACES.map((surface, index) => [surface.value, index]));

function sortVariants(a: Model, b: Model): number {
  if (a.authType !== b.authType) return a.authType === "api_key" ? -1 : 1;
  return (surfaceOrder.get(a.apiSurface) ?? 0) - (surfaceOrder.get(b.apiSurface) ?? 0);
}

function finishGroup(group: ModelGroup): ModelGroup {
  group.variants.sort(sortVariants);
  group.apiSurfaces = [...new Set(group.variants.map((variant) => variant.apiSurface))];
  group.capabilities = [
    ...new Set(group.variants.flatMap((variant) => variant.params.map((param) => param.path))),
  ];
  group.maxParams = Math.max(...group.variants.map((variant) => variant.params.length));
  return group;
}

export function groupModels(models: Model[]): ModelGroup[] {
  const groups = new Map<string, ModelGroup>();
  for (const entry of models) {
    const key = `${entry.provider}/${entry.model}`;
    const group = groups.get(key) ?? {
      key,
      provider: entry.provider,
      model: entry.model,
      variants: [],
      apiSurfaces: [],
      capabilities: [],
      maxParams: 0,
    };
    group.variants.push(entry);
    groups.set(key, group);
  }
  return [...groups.values()].map(finishGroup);
}

export interface ApiSurfaceFacet {
  apiSurface: ApiSurface;
  count: number;
}

export function buildApiSurfaceFacets(groups: ModelGroup[]): ApiSurfaceFacet[] {
  return API_SURFACES.map(({ value }) => ({
    apiSurface: value,
    count: groups.filter((group) => group.apiSurfaces.includes(value)).length,
  })).filter((facet) => facet.count > 0);
}

export function buildModelGroupProviderFacets(groups: ModelGroup[]): ProviderFacet[] {
  const counts = new Map<string, number>();
  for (const group of groups) {
    counts.set(group.provider, (counts.get(group.provider) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([provider, count]) => ({ provider, count }))
    .sort((a, b) => b.count - a.count || a.provider.localeCompare(b.provider));
}
