import path from "node:path";
import ejs from "ejs";
import { paramGroupLabel } from "../data/display.js";
import {
  buildParameterIndex,
  modelsWithoutParameter,
  type ParameterDetail,
} from "../data/parameters.js";
import { VIEWS_DIR } from "../data/paths.js";
import { SITE_NAME, SITE_URL } from "../data/site.js";
import { GLOSSARY_PATH, absolute, parameterPagePath } from "../data/urls.js";
import { type Model, type Parameter } from "../schema/model.js";
import { buildParameterStructuredData } from "./structured-data.js";
import { hubLinks, renderShell, viewHelpers } from "./render.js";

const RELATED_LIMIT = 12;

export function parameterPageTitle(detail: ParameterDetail): string {
  return `${detail.label} (${detail.path}) parameter — defaults & ranges · ${SITE_NAME}`;
}

export function parameterPageDescription(detail: ParameterDetail): string {
  const group = paramGroupLabel(detail.group).toLowerCase();
  const models = `${detail.modelCount} model${detail.modelCount === 1 ? "" : "s"}`;
  return `${detail.label} (${detail.path}) is an LLM ${group} parameter. Compare its type, default, and valid range across the ${models} in the catalog that accept it.`;
}

function rangeOf(param: Parameter): { min?: number; max?: number } | undefined {
  return (param.type === "integer" || param.type === "number") && param.range
    ? param.range
    : undefined;
}

/** Most common default across the models that set one, or a "varies" note. */
function defaultSummary(detail: ParameterDetail): string {
  const defaults = detail.usages
    .map((u) => u.param.default)
    .filter((d): d is NonNullable<typeof d> => d !== undefined)
    .map((d) => JSON.stringify(d));
  if (defaults.length === 0) return "no default";
  const unique = [...new Set(defaults)];
  return unique.length === 1 ? unique[0]! : "varies by model";
}

/** Widest numeric span any model allows, e.g. "0 – 2". */
function rangeSummary(detail: ParameterDetail): string {
  let min: number | undefined;
  let max: number | undefined;
  for (const usage of detail.usages) {
    const range = rangeOf(usage.param);
    if (range?.min !== undefined) min = min === undefined ? range.min : Math.min(min, range.min);
    if (range?.max !== undefined) max = max === undefined ? range.max : Math.max(max, range.max);
  }
  if (min === undefined && max === undefined) return "";
  return `${min ?? "−∞"} – ${max ?? "+∞"}`;
}

function relatedParameters(detail: ParameterDetail, allModels: Model[]): ParameterDetail[] {
  return buildParameterIndex(allModels)
    .filter((other) => other.group === detail.group && other.path !== detail.path)
    .slice(0, RELATED_LIMIT);
}

export async function renderParameterPage(
  detail: ParameterDetail,
  allModels: Model[],
): Promise<string> {
  const description = parameterPageDescription(detail);
  const body = await ejs.renderFile(path.join(VIEWS_DIR, "parameter.ejs"), {
    detail,
    helpers: viewHelpers,
    groupLabel: paramGroupLabel(detail.group),
    defaultSummary: defaultSummary(detail),
    rangeSummary: rangeSummary(detail),
    related: relatedParameters(detail, allModels),
    notDocumented: modelsWithoutParameter(detail, allModels),
    glossaryPath: GLOSSARY_PATH,
  });

  return renderShell(
    {
      title: parameterPageTitle(detail),
      description,
      canonicalUrl: absolute(SITE_URL, parameterPagePath(detail.path)),
      structuredData: buildParameterStructuredData(detail, description, SITE_URL),
      providerHubs: hubLinks(allModels),
    },
    body,
  );
}
