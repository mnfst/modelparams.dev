import type { AuthType, Model } from "../schema/model.js";

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  "x-ai": "xAI",
  meta: "Meta",
  mistral: "Mistral",
  deepseek: "DeepSeek",
  cohere: "Cohere",
  perplexity: "Perplexity",
  "z-ai": "Z.ai",
};

const MODEL_LABEL_OVERRIDES: Record<string, string> = {
  "openai/gpt-4o": "GPT-4o",
  "openai/gpt-4o-mini": "GPT-4o mini",
  "openai/o1": "o1",
  "openai/o1-mini": "o1-mini",
  "openai/o3": "o3",
  "openai/o3-mini": "o3-mini",
  "openai/o4-mini": "o4-mini",
  "z-ai/glm-5.1": "GLM-5.1",
  "z-ai/glm-5": "GLM-5",
  "z-ai/glm-5-turbo": "GLM-5-Turbo",
  "z-ai/glm-4.7": "GLM-4.7",
  "z-ai/glm-4.7-flash": "GLM-4.7-Flash",
  "z-ai/glm-4.7-flashx": "GLM-4.7-FlashX",
  "z-ai/glm-4.6": "GLM-4.6",
  "z-ai/glm-4.5": "GLM-4.5",
  "z-ai/glm-4.5-air": "GLM-4.5-Air",
  "z-ai/glm-4.5-x": "GLM-4.5-X",
  "z-ai/glm-4.5-airx": "GLM-4.5-AirX",
  "z-ai/glm-4.5-flash": "GLM-4.5-Flash",
};

const AUTH_LABELS: Record<AuthType, string> = {
  api_key: "API key",
  subscription: "Subscription",
};

const PARAM_GROUP_LABELS: Record<string, string> = {
  generation_length: "Length",
  sampling: "Sampling",
  reasoning: "Reasoning",
  tooling: "Tools",
  output_format: "Output",
  observability: "Observability",
  provider_metadata: "Metadata",
};

const SVG_ATTRS =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"';

const PARAM_GROUP_ICONS: Record<string, string> = {
  generation_length: `<svg ${SVG_ATTRS}><path stroke-linecap="round" stroke-linejoin="round" d="M3 12h18M3 12l3-3m-3 3 3 3m15-3-3-3m3 3-3 3" /></svg>`,
  sampling: `<svg ${SVG_ATTRS}><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" /></svg>`,
  reasoning: `<svg ${SVG_ATTRS}><path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>`,
  tooling: `<svg ${SVG_ATTRS}><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" /></svg>`,
  output_format: `<svg ${SVG_ATTRS}><path stroke-linecap="round" stroke-linejoin="round" d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" /></svg>`,
  observability: `<svg ${SVG_ATTRS}><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`,
  provider_metadata: `<svg ${SVG_ATTRS}><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z" /></svg>`,
};

const CONDITION_ICONS = {
  only: `<svg ${SVG_ATTRS}><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" /></svg>`,
  except: `<svg ${SVG_ATTRS}><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>`,
};

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((part) => (part.length === 0 ? part : part[0]!.toUpperCase() + part.slice(1)))
    .join(" ");
}

function mergeAdjacentNumbers(parts: string[]): string[] {
  const out: string[] = [];
  for (const part of parts) {
    const prev = out[out.length - 1];
    if (prev !== undefined && /^\d+$/.test(prev) && /^\d+$/.test(part)) {
      out[out.length - 1] = `${prev}.${part}`;
    } else {
      out.push(part);
    }
  }
  return out;
}

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? titleCase(provider);
}

export function modelLabel(model: Pick<Model, "provider" | "model">): string {
  const key = `${model.provider}/${model.model}`;
  if (MODEL_LABEL_OVERRIDES[key]) return MODEL_LABEL_OVERRIDES[key];
  const parts = mergeAdjacentNumbers(model.model.split("-"));
  return parts
    .map((part) => (/^\d+(\.\d+)?$/.test(part) ? part : part[0]!.toUpperCase() + part.slice(1)))
    .join(" ");
}

export function authLabel(authType: AuthType): string {
  return AUTH_LABELS[authType];
}

export function paramGroupLabel(group: string): string {
  return PARAM_GROUP_LABELS[group] ?? titleCase(group.replace(/_/g, "-"));
}

export function paramGroupIcon(group: string): string {
  return PARAM_GROUP_ICONS[group] ?? "";
}

export function conditionIcon(kind: "only" | "except"): string {
  return CONDITION_ICONS[kind];
}
