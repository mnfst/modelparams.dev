import path from "node:path";
import ejs from "ejs";
import { modelLabel, providerLabel } from "../data/display.js";
import { VIEWS_DIR } from "../data/paths.js";
import { SITE_NAME, SITE_URL } from "../data/site.js";
import { absolute, ogImagePath, providerPagePath } from "../data/urls.js";
import { modelId, type Model } from "../schema/model.js";
import { buildProviderStructuredData } from "./structured-data.js";
import { DESCRIPTION_MAX, fitDescription, sampleList } from "./meta.js";
import { hubLinks, renderShell, viewHelpers } from "./render.js";

export function providerPageTitle(provider: string): string {
  return `${providerLabel(provider)} model parameters · ${SITE_NAME}`;
}

const PARAM_TAIL = ". Type, default, range, and gating conditions for each.";

export function providerPageDescription(provider: string, models: Model[]): string {
  const count = `${models.length} ${providerLabel(provider)} model${models.length === 1 ? "" : "s"}`;
  const head = `Parameters for ${count}`;
  const sample = sampleList(
    sampleParams(models),
    DESCRIPTION_MAX - head.length - PARAM_TAIL.length - 2,
  );
  return fitDescription([
    `${head}: ${sample}${PARAM_TAIL}`,
    `${head}${PARAM_TAIL}`,
    `${head} — type, default, range, and gating conditions.`,
  ]);
}

function sampleParams(models: Model[]): string[] {
  const seen = new Set<string>();
  for (const model of models) {
    for (const param of model.params) seen.add(param.path);
  }
  return [...seen];
}

export function providerIntro(provider: string, models: Model[]): string {
  const count = `${models.length} ${providerLabel(provider)} model${models.length === 1 ? "" : "s"}`;
  return `${SITE_NAME} tracks parameters for ${count}. Open a model to see its full set: the type, default, valid range or values, and the conditions that gate each parameter.`;
}

export async function renderProviderPage(
  provider: string,
  providerModels: Model[],
  allModels: Model[],
): Promise<string> {
  const models = [...providerModels].sort((a, b) => modelLabel(a).localeCompare(modelLabel(b)));
  const otherProviders = hubLinks(allModels).filter(
    (hub) => hub.href !== providerPagePath(provider),
  );

  const body = await ejs.renderFile(path.join(VIEWS_DIR, "provider.ejs"), {
    providerName: providerLabel(provider),
    models,
    helpers: viewHelpers,
    otherProviders,
    intro: providerIntro(provider, models),
  });

  const description = providerPageDescription(provider, models);
  return renderShell(
    {
      title: providerPageTitle(provider),
      description,
      canonicalUrl: absolute(SITE_URL, providerPagePath(provider)),
      ogImage: ogImagePath(providerPagePath(provider)),
      structuredData: buildProviderStructuredData(provider, models, description, SITE_URL),
      providerHubs: hubLinks(allModels),
    },
    body,
  );
}
