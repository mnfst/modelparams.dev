import { authSuffix, type Model, type Parameter } from "../schema/model.js";

export interface ModelParamsResponse {
  model: string;
  params: Parameter[];
}

export function modelParamSlug(model: Pick<Model, "model" | "authType">): string {
  return `${model.model}${authSuffix(model.authType)}`;
}

export function modelParamsResponse(model: Model): ModelParamsResponse {
  return {
    model: modelParamSlug(model),
    params: model.params,
  };
}

export function listModelParamsResponses(models: Model[]): ModelParamsResponse[] {
  const bySlug = new Map<string, ModelParamsResponse>();
  const signatures = new Map<string, string>();
  const ambiguous = new Set<string>();

  for (const model of models) {
    const response = modelParamsResponse(model);
    const signature = JSON.stringify(
      [...response.params].sort((a, b) => a.path.localeCompare(b.path)),
    );
    const existing = signatures.get(response.model);
    if (existing !== undefined && existing !== signature) {
      // Several providers serve this model id with different param surfaces, so
      // a bare slug has no single truthful answer — use provider/model instead.
      ambiguous.add(response.model);
      continue;
    }
    signatures.set(response.model, signature);
    bySlug.set(response.model, response);
  }

  for (const slug of ambiguous) bySlug.delete(slug);
  return [...bySlug.values()].sort((a, b) => a.model.localeCompare(b.model));
}

export function findModelParams(models: Model[], slug: string): ModelParamsResponse | null {
  return listModelParamsResponses(models).find((model) => model.model === slug) ?? null;
}
