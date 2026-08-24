import path from "node:path";
import ejs from "ejs";
import { describeApplicability } from "../data/applicability.js";
import { apiSurfaceLabel } from "../data/api-surfaces.js";
import { modelFullLabel, modelLabel, paramGroupLabel, providerLabel } from "../data/display.js";
import { modelFaq } from "../data/faq.js";
import { groupParams } from "../data/group.js";
import { VIEWS_DIR } from "../data/paths.js";
import { SITE_NAME, SITE_URL } from "../data/site.js";
import {
  DISAMBIGUATION_PATH,
  absolute,
  modelJsonPath,
  modelPagePath,
  ogImagePath,
  providerPagePath,
} from "../data/urls.js";
import { modelId, type Model, type Parameter } from "../schema/model.js";
import { buildModelStructuredData } from "./structured-data.js";
import { DESCRIPTION_MAX, fitDescription, fitTitle, sampleList } from "./meta.js";
import { hubLinks, renderShell, viewHelpers } from "./render.js";

function authNote(model: Model): string {
  return model.authType === "subscription" ? " via subscription" : "";
}

export function modelPageTitle(model: Model): string {
  // The auth variant is never dropped: the API-key and subscription pages are
  // separate URLs, so a fallback without it would give them the same title.
  const variant = model.authType === "subscription" ? " (subscription)" : "";
  const who = `${modelFullLabel(model)}${variant}`;
  // "API" survives every fallback, including the shortest. Bare "<model>
  // parameters" is what people type when they want a weight count, and a title
  // that matches it pulls the page into the wrong result set — so the site name
  // and then the provider prefix go first, and the qualifier never does.
  return fitTitle([
    `${who} API parameters · ${SITE_NAME}`,
    `${who} API parameters`,
    `${modelLabel(model)}${variant} API parameters`,
  ]);
}

const PARAM_TAIL = ". Type, default, range, and gating conditions for each.";

export function modelPageDescription(model: Model): string {
  const who = `${modelFullLabel(model)} on ${apiSurfaceLabel(model.apiSurface)}${authNote(model)}`;
  if (model.params.length === 0) {
    return `${who}: no API parameters documented yet. Browse the open catalog of LLM API parameters on ${SITE_NAME}.`;
  }
  const count = `${model.params.length} API parameter${model.params.length === 1 ? "" : "s"}`;
  const head = `All ${count} for ${who}`;
  const paths = model.params.map((param) => param.path);
  const sample = sampleList(paths, DESCRIPTION_MAX - head.length - PARAM_TAIL.length - 2);
  // A long model name can leave no room for even one parameter path; when that
  // happens the sample is dropped rather than allowed to overflow.
  return fitDescription([
    `${head}: ${sample}${PARAM_TAIL}`,
    `${head}${PARAM_TAIL}`,
    `${who}: ${count}, with type, default, range, and gating conditions.`,
  ]);
}

/** A short, factual clause describing a parameter's default, range, values, and gate. */
function paramFact(param: Parameter): string {
  const bits: string[] = [];
  if (param.default !== undefined) bits.push(`defaults to ${JSON.stringify(param.default)}`);
  if ((param.type === "integer" || param.type === "number") && param.range) {
    const { min, max } = param.range;
    if (min !== undefined && max !== undefined) bits.push(`range ${min}–${max}`);
    else if (min !== undefined) bits.push(`minimum ${min}`);
    else if (max !== undefined) bits.push(`maximum ${max}`);
  }
  if (param.type === "enum") {
    const values = param.values.map((value) => JSON.stringify(value));
    const shown = values.slice(0, 6).join(", ");
    bits.push(`accepts ${shown}${values.length > 6 ? ", …" : ""}`);
  }
  const applicability = describeApplicability(param.applicability);
  if (applicability.only.length > 0) bits.push(`only when ${applicability.only.join(" and ")}`);
  else if (applicability.except.length > 0) bits.push(`not when ${applicability.except.join(" or ")}`);
  return bits.join(", ");
}

export interface ParamProseGroup {
  label: string;
  clauses: { path: string; fact: string }[];
}

/** Per-group prose summary of the parameter set — readable, exact-match-friendly text. */
export function modelParamProse(model: Model): ParamProseGroup[] {
  return groupParams(model.params).map(({ group, params }) => ({
    label: paramGroupLabel(group),
    clauses: params.map((param) => ({ path: param.path, fact: paramFact(param) })),
  }));
}

export function modelIntro(model: Model): string {
  const who = modelFullLabel(model);
  if (model.params.length === 0) {
    return `No API parameters are documented yet for ${who}. The data is community-maintained, so this page fills in as entries land.`;
  }
  const access = model.authType === "subscription" ? " through a subscription" : " with an API key";
  const surface = apiSurfaceLabel(model.apiSurface);
  return `These are the API parameters ${SITE_NAME} tracks for ${who} on ${surface}${access} — the settings you send in a request. Each row gives the type, default, valid range or values, and the conditions that gate it. It's the same data the JSON API serves.`;
}

export function modelLifecycleSummary(model: Model): string | null {
  const status = model.status;
  const parts: string[] = [];
  if (status === "deprecated") parts.push("This model is deprecated.");
  if (status === "retired") parts.push("This model is retired.");
  if (model.shutdownOn) parts.push(`Shutdown date: ${model.shutdownOn}.`);
  if (model.replacement) parts.push(`Suggested replacement: ${model.replacement}.`);
  return parts.length > 0 ? parts.join(" ") : null;
}

export async function renderModelPage(model: Model, allModels: Model[]): Promise<string> {
  const siblings = allModels
    .filter((other) => other.provider === model.provider && modelId(other) !== modelId(model))
    .sort((a, b) => modelLabel(a).localeCompare(modelLabel(b)));

  const faqs = modelFaq(model);
  const body = await ejs.renderFile(path.join(VIEWS_DIR, "model.ejs"), {
    model,
    helpers: viewHelpers,
    siblings,
    faqs,
    intro: modelIntro(model),
    lifecycleSummary: modelLifecycleSummary(model),
    providerName: providerLabel(model.provider),
    surfaceName: apiSurfaceLabel(model.apiSurface),
    modelName: modelLabel(model),
    fullName: modelFullLabel(model),
    providerPath: providerPagePath(model.provider),
    jsonPath: modelJsonPath(model),
    modelJson: JSON.stringify({ $schema: "https://modelparams.dev/api/v1/schema.json", ...model }, null, 2),
    isSubscription: model.authType === "subscription",
    proseGroups: modelParamProse(model),
    disambiguationPath: DISAMBIGUATION_PATH,
  });

  const description = modelPageDescription(model);
  return renderShell(
    {
      title: modelPageTitle(model),
      description,
      canonicalUrl: absolute(SITE_URL, modelPagePath(model)),
      ogImage: ogImagePath(modelPagePath(model)),
      ogType: "article",
      structuredData: buildModelStructuredData(model, description, SITE_URL, faqs),
      providerHubs: hubLinks(allModels),
    },
    body,
  );
}
