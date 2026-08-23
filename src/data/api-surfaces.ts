import { ApiSurface, type ApiSurface as ApiSurfaceName } from "../schema/model.js";

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
  "openai-responses": { label: "Responses", sdkMethod: "responses.create" },
  "anthropic-messages": { label: "Messages", sdkMethod: "messages.create" },
  "google-generate-content": {
    label: "Gemini generateContent",
    sdkMethod: "models.generateContent",
  },
  "amazon-bedrock-converse": { label: "Bedrock Converse", sdkMethod: "ConverseCommand" },
  "google-vertex-generate-content": {
    label: "Vertex generateContent",
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
