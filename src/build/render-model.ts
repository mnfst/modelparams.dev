import path from "node:path";
import ejs from "ejs";
import { modelLabel, providerLabel } from "../data/display.js";
import { VIEWS_DIR } from "../data/paths.js";
import { SITE_NAME, SITE_URL } from "../data/site.js";
import { absolute, modelJsonPath, modelPagePath, providerPagePath } from "../data/urls.js";
import { modelId, type Model } from "../schema/model.js";
import { buildModelStructuredData } from "./structured-data.js";
import { hubLinks, renderShell, viewHelpers } from "./render.js";

function authNote(model: Model): string {
  return model.authType === "subscription" ? " via subscription" : "";
}

export function modelPageTitle(model: Model): string {
  const variant = model.authType === "subscription" ? " (subscription)" : "";
  return `${providerLabel(model.provider)} ${modelLabel(model)}${variant} parameters · ${SITE_NAME}`;
}

export function modelPageDescription(model: Model): string {
  const who = `${providerLabel(model.provider)} ${modelLabel(model)}${authNote(model)}`;
  if (model.params.length === 0) {
    return `${who}: no parameters documented yet. Browse the open catalog of LLM model parameters on ${SITE_NAME}.`;
  }
  const paths = model.params.map((param) => param.path);
  const sample = paths.slice(0, 4).join(", ");
  const more = paths.length > 4 ? ", and more" : "";
  const count = `${model.params.length} API parameter${model.params.length === 1 ? "" : "s"}`;
  return `All ${count} for ${who}: ${sample}${more}. See each type, default, range, and the conditions that gate it.`;
}

export function modelIntro(model: Model): string {
  const who = `${providerLabel(model.provider)} ${modelLabel(model)}`;
  if (model.params.length === 0) {
    return `No parameters are documented yet for ${who}. The data is community-maintained, so this page fills in as entries land.`;
  }
  const access =
    model.authType === "subscription"
      ? " when you reach it through a subscription rather than an API key"
      : "";
  return `These are the parameters ${SITE_NAME} tracks for ${who}${access}. Each row gives the type, default, valid range or values, and the conditions that gate it. It's the same data the JSON API serves.`;
}

export async function renderModelPage(model: Model, allModels: Model[]): Promise<string> {
  const siblings = allModels
    .filter((other) => other.provider === model.provider && modelId(other) !== modelId(model))
    .sort((a, b) => modelLabel(a).localeCompare(modelLabel(b)));

  const body = await ejs.renderFile(path.join(VIEWS_DIR, "model.ejs"), {
    model,
    helpers: viewHelpers,
    siblings,
    intro: modelIntro(model),
    providerName: providerLabel(model.provider),
    modelName: modelLabel(model),
    providerPath: providerPagePath(model.provider),
    jsonPath: modelJsonPath(model),
    isSubscription: model.authType === "subscription",
  });

  const description = modelPageDescription(model);
  return renderShell(
    {
      title: modelPageTitle(model),
      description,
      canonicalUrl: absolute(SITE_URL, modelPagePath(model)),
      structuredData: buildModelStructuredData(model, description, SITE_URL),
      providerHubs: hubLinks(allModels),
    },
    body,
  );
}
