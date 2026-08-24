import { ApiSurface, type ApiSurface as ApiSurfaceName, type Model } from "../schema/model.js";

export interface ApiSurfaceMeta {
  value: ApiSurfaceName;
  label: string;
  sdkMethod: string;
}

const META: Record<ApiSurfaceName, Omit<ApiSurfaceMeta, "value">> = {
  "openai-chat-completions": {
    label: "Chat Completions",
    sdkMethod: "chat.completions.create",
  },
  "openai-responses": { label: "Responses API", sdkMethod: "responses.create" },
  "anthropic-messages": { label: "Messages API", sdkMethod: "messages.create" },
  "google-generate-content": {
    label: "Generate content",
    sdkMethod: "models.generateContent",
  },
  "amazon-bedrock-converse": { label: "Converse API", sdkMethod: "ConverseCommand" },
  "google-vertex-generate-content": {
    label: "Vertex generate content",
    sdkMethod: "generateContent",
  },
  "cohere-chat": { label: "Cohere Chat", sdkMethod: "chat" },
};

export const API_SURFACES: ApiSurfaceMeta[] = ApiSurface.options.map((value) => ({
  value,
  ...META[value],
}));

export function apiSurfaceLabel(surface: ApiSurfaceName): string {
  return META[surface].label;
}

export function apiSurfaceSdkMethod(surface: ApiSurfaceName): string {
  return META[surface].sdkMethod;
}

export interface ApiSurfaceFacet {
  apiSurface: ApiSurfaceName;
  count: number;
}

export function buildApiSurfaceFacets(models: Model[]): ApiSurfaceFacet[] {
  return API_SURFACES.map(({ value }) => ({
    apiSurface: value,
    count: models.filter((model) => model.apiSurface === value).length,
  })).filter((facet) => facet.count > 0);
}
