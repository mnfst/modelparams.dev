import { describeApplicability } from "./applicability.js";
import { buildProviderFacets } from "./catalog.js";
import { authLabel, modelLabel, paramGroupLabel, providerLabel } from "./display.js";
import { groupParams } from "./group.js";
import { buildParameterIndex } from "./parameters.js";
import { parameterPagePath } from "./urls.js";
import { modelId, type Model, type Parameter } from "../schema/model.js";

const REPO_URL = "https://github.com/mnfst/modelparams.dev";

function modelJsonUrl(siteUrl: string, model: Model): string {
  return `${siteUrl}/api/v1/models/${modelId(model)}.json`;
}

function modelTitle(model: Model): string {
  const variant = model.authType === "subscription" ? ` (${authLabel(model.authType)})` : "";
  return `${providerLabel(model.provider)} ${modelLabel(model)}${variant}`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function guideIntro(siteUrl: string): string[] {
  return [
    "# How to use modelparams.dev",
    "",
    `[modelparams.dev](${siteUrl}) is an open, community-maintained catalog of model`,
    "parameters. Each entry shows the knobs you can turn — type, default, range, and the",
    "conditions that gate it.",
    "",
    "The same model accessed via an **API key** and via a **subscription** usually exposes a",
    "different set of parameters. We list both as separate entries so the data stays honest.",
    "",
  ];
}

function guideApi(siteUrl: string): string[] {
  return [
    "## Catalog API",
    "",
    "The full catalog is static JSON, CORS-enabled, served from the edge:",
    "",
    "```bash",
    `curl ${siteUrl}/api/v1/models.json`,
    "```",
    "",
    "Each entry is keyed by `provider/model` for API-key variants; subscription variants",
    "append `-subscription`.",
    "",
    "When you only need the parameter list for a model contract, use the providerless",
    "params endpoint. Subscription contracts are model slugs with `-subscription`:",
    "",
    "```bash",
    `curl ${siteUrl}/api/v1/params/gpt-5.5.json`,
    `curl ${siteUrl}/api/v1/params/gpt-5.5-subscription.json`,
    "```",
    "",
    "## Single model",
    "",
    "```bash",
    `curl ${siteUrl}/api/v1/models/anthropic/claude-opus-4-7.json`,
    `curl ${siteUrl}/api/v1/models/anthropic/claude-opus-4-7-subscription.json`,
    "```",
    "",
    "## JSON Schema",
    "",
    "Every entry validates against a JSON Schema you can use in your editor or pipeline:",
    "",
    "```bash",
    `curl ${siteUrl}/api/v1/schema.json`,
    "```",
    "",
    "Add this header to any YAML you author for autocomplete in VS Code:",
    "",
    "```yaml",
    `# yaml-language-server: $schema=${siteUrl}/api/v1/schema.json`,
    "```",
    "",
    "## Logos",
    "",
    "Provider logos are at `/assets/logos/{provider}.svg`. They use `currentColor`, so they",
    "inherit your text color:",
    "",
    "```bash",
    `curl ${siteUrl}/assets/logos/anthropic.svg`,
    "```",
    "",
  ];
}

function guideAgents(siteUrl: string): string[] {
  return [
    "## Contribute",
    "",
    "The data lives in YAML under `models/{provider}/{model}-{auth}.yaml` in the",
    `[GitHub repo](${REPO_URL}). Open a PR; CI validates against the schema and rebuilds.`,
    "",
    "## For agents",
    "",
    `- Machine-readable site overview: ${siteUrl}/llms.txt`,
    `- Full usage guide plus every parameter inline: ${siteUrl}/llms-full.txt`,
    "- When your browser supports it, this page registers in-browser **WebMCP** tools on",
    "  `navigator.modelContext`: `search_models`, `get_model_parameters`, `list_providers`,",
    "  `list_parameters`, and `get_usage_guide`.",
    "",
  ];
}

/**
 * The "How to use" guide as Markdown. This is the canonical agent-facing doc:
 * it backs the modal's Copy button and the body of /llms-full.txt.
 */
export function usageGuideMarkdown(siteUrl: string): string {
  return [...guideIntro(siteUrl), ...guideApi(siteUrl), ...guideAgents(siteUrl)].join("\n");
}

function fmtValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return `"${value}"`;
  return String(value);
}

function paramConstraints(param: Parameter): string {
  const bits: string[] = [];
  if (param.default !== undefined) bits.push(`default: ${fmtValue(param.default)}`);
  if (param.type === "enum") bits.push(`values: ${param.values.map(fmtValue).join(", ")}`);
  if ((param.type === "integer" || param.type === "number") && param.range) {
    const range: string[] = [];
    if (param.range.min !== undefined) range.push(`min ${param.range.min}`);
    if (param.range.max !== undefined) range.push(`max ${param.range.max}`);
    if (param.range.step !== undefined) range.push(`step ${param.range.step}`);
    if (range.length > 0) bits.push(`range: ${range.join(", ")}`);
  }
  const applicability = describeApplicability(param.applicability);
  if (applicability.only.length > 0) bits.push(`only when ${applicability.only.join("; ")}`);
  if (applicability.except.length > 0) bits.push(`except when ${applicability.except.join("; ")}`);
  return bits.length > 0 ? ` [${bits.join("] [")}]` : "";
}

function paramLine(param: Parameter): string {
  return `- \`${param.path}\` (${param.type}, ${paramGroupLabel(param.group)}) — ${param.description}${paramConstraints(param)}`;
}

function sortById(models: Model[]): Model[] {
  return [...models].sort((a, b) => modelId(a).localeCompare(modelId(b)));
}

/**
 * Concise, link-first overview following the llms.txt convention (llmstxt.org):
 * H1, blockquote summary, then sectioned lists of links agents can fetch.
 */
export function buildLlmsTxt(siteUrl: string, models: Model[]): string {
  const lines: string[] = [
    "# modelparams.dev",
    "",
    "> An open, community-maintained catalog of model parameters — every knob you can",
    "> turn, for every model, with API-key and subscription variants tracked separately.",
    "",
    "All data is machine-readable: CORS-enabled static JSON validated against a published JSON",
    "Schema, served from the edge under `/api/v1/`. IDs are `provider/model` for API-key",
    "variants and `provider/model-subscription` for subscription variants.",
    "",
    "## API",
    `- [Full catalog](${siteUrl}/api/v1/models.json): Every model and its parameters in one JSON file (${plural(models.length, "model")}).`,
    `- [Providerless params](${siteUrl}/api/v1/params/gpt-5.5.json): Params for one model slug; append \`-subscription\` for subscription contracts.`,
    `- [JSON Schema](${siteUrl}/api/v1/schema.json): Validates every entry; use it for editor autocomplete or CI checks.`,
    `- [API index](${siteUrl}/api/v1/index.json): Endpoint map and live model count.`,
    "",
    "## Guides",
    `- [Usage guide + full parameter dump](${siteUrl}/llms-full.txt): How to call the API plus every model's parameters inline.`,
    "",
    "## Parameters",
  ];
  for (const detail of buildParameterIndex(models)) {
    lines.push(
      `- [${detail.path}](${siteUrl}${parameterPagePath(detail.path)}): ${detail.label} — default, range, and the ${plural(detail.modelCount, "model")} that accept it.`,
    );
  }
  lines.push("", "## Models");
  for (const model of sortById(models)) {
    lines.push(
      `- [${modelId(model)}](${modelJsonUrl(siteUrl, model)}): ${modelTitle(model)} — ${plural(model.params.length, "parameter")}.`,
    );
  }
  lines.push(
    "",
    "## Optional",
    `- [GitHub repository](${REPO_URL}): Source data, JSON Schema, and contribution guide.`,
    `- [Web catalog](${siteUrl}/): Searchable HTML view that also exposes WebMCP tools to in-browser agents.`,
    "",
  );
  return lines.join("\n");
}

function modelSection(siteUrl: string, model: Model): string[] {
  const lines = [
    `### ${modelId(model)}`,
    "",
    `${modelTitle(model)} · JSON: ${modelJsonUrl(siteUrl, model)}`,
    "",
  ];
  if (model.params.length === 0) {
    lines.push("_No parameters documented yet._", "");
    return lines;
  }
  for (const { params } of groupParams(model.params)) {
    for (const param of params) lines.push(paramLine(param));
  }
  lines.push("");
  return lines;
}

/**
 * The complete agent payload: the usage guide followed by every model's parameters
 * inline, grouped by provider. Served at /llms-full.txt.
 */
export function buildLlmsFullTxt(siteUrl: string, models: Model[]): string {
  const lines: string[] = [
    usageGuideMarkdown(siteUrl).trimEnd(),
    "",
    "---",
    "",
    "# Full catalog",
    "",
    `${plural(models.length, "model")}, grouped by provider. Each line reads: \`path\` (type,`,
    "group) — description, then defaults, ranges, allowed values, and applicability conditions",
    "in brackets.",
    "",
  ];
  for (const facet of buildProviderFacets(models)) {
    lines.push(`## ${providerLabel(facet.provider)}`, "");
    const group = sortById(models.filter((model) => model.provider === facet.provider));
    for (const model of group) lines.push(...modelSection(siteUrl, model));
  }
  return lines.join("\n");
}
