// Per-page social-share images. Every page gets its own 1200×630 PNG built from
// the same catalog data the page renders, so a shared model or parameter link
// previews with its actual name and facts instead of one generic site card.
//
// Rasterization is deterministic: resvg renders with the three vendored Outfit
// TTFs and `loadSystemFonts: false`, so the output never depends on whatever
// fonts happen to exist on the build machine.

import fs from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { modelLabel, paramGroupLabel, providerLabel } from "../data/display.js";
import { buildParameterIndex, type ParameterDetail } from "../data/parameters.js";
import { CLIENT_DIR, DIST_ASSETS_DIR, DIST_DIR } from "../data/paths.js";
import {
  API_PATH,
  GLOSSARY_PATH,
  modelPagePath,
  ogImagePath,
  providerPagePath,
} from "../data/urls.js";
import type { Model } from "../schema/model.js";
import { renderOgCard, type OgCard } from "./og-card.js";

const FONT_FILES = ["outfit-400.ttf", "outfit-600.ttf", "outfit-700.ttf"].map((name) =>
  path.join(CLIENT_DIR, "fonts", name),
);

const CHIP_LIMIT = 4;

function toPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "Outfit" },
    fitTo: { mode: "width", value: 1200 },
  });
  return Buffer.from(resvg.render().asPng());
}

/** Distinct parameter paths across a set of models, in first-seen order. */
function paramPaths(models: Model[]): string[] {
  const seen = new Set<string>();
  for (const model of models) {
    for (const param of model.params) seen.add(param.path);
  }
  return [...seen];
}

export function homeCard(models: Model[], providerCount: number): OgCard {
  return {
    headline: "Every parameter, for every model.",
    subline: `${models.length} models · ${providerCount} providers · open JSON API`,
    chips: paramPaths(models).slice(0, CHIP_LIMIT),
  };
}

export function modelCard(model: Model): OgCard {
  const subscription = model.authType === "subscription";
  const count = model.params.length;
  return {
    eyebrow: `${providerLabel(model.provider)}${subscription ? " · Subscription" : ""}`,
    headline: modelLabel(model),
    subline: `${count} API parameter${count === 1 ? "" : "s"} · type, default, range, conditions`,
    chips: model.params.slice(0, CHIP_LIMIT).map((param) => param.path),
  };
}

export function providerCard(provider: string, models: Model[]): OgCard {
  const paths = paramPaths(models);
  return {
    eyebrow: "Provider",
    headline: `${providerLabel(provider)} model parameters`,
    subline: `${models.length} model${models.length === 1 ? "" : "s"} · ${paths.length} parameters tracked`,
    chips: paths.slice(0, CHIP_LIMIT),
  };
}

export function parameterCard(detail: ParameterDetail, facts: string[]): OgCard {
  const count = detail.modelCount;
  return {
    eyebrow: `${paramGroupLabel(detail.group)} parameter`,
    headline: detail.path,
    subline: [...facts, `${count} model${count === 1 ? "" : "s"}`].join(" · "),
    chips: [...new Set(detail.usages.map((usage) => usage.providerName))].slice(0, CHIP_LIMIT),
  };
}

export function glossaryCard(parameterCount: number): OgCard {
  return {
    eyebrow: "Glossary",
    headline: "LLM parameter glossary",
    subline: `${parameterCount} parameters defined, with defaults and ranges`,
  };
}

export function apiCard(modelCount: number): OgCard {
  return {
    eyebrow: "Documentation",
    headline: "modelparams.dev API",
    subline: `${modelCount} models · static JSON · CORS-enabled · MIT licensed`,
  };
}

/** Writes one card to the dist path that `ogImagePath` advertises for `pagePath`. */
async function writeCard(pagePath: string, card: OgCard): Promise<void> {
  const file = path.join(DIST_DIR, ogImagePath(pagePath).replace(/^\//, ""));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, toPng(renderOgCard(card)));
}

/** Short "Default 1 · Range 0 – 2" facts for a parameter card. */
function parameterFacts(detail: ParameterDetail, summaries: ParameterSummaries): string[] {
  const facts: string[] = [];
  const fallback = summaries.defaultSummary(detail);
  if (fallback !== "no default") facts.push(`Default ${fallback}`);
  const range = summaries.rangeSummary(detail);
  if (range) facts.push(`Range ${range}`);
  return facts;
}

export interface ParameterSummaries {
  defaultSummary: (detail: ParameterDetail) => string;
  rangeSummary: (detail: ParameterDetail) => string;
}

/**
 * Generates every page's card plus the site-wide default at /assets/og.png,
 * which remains the fallback for any surface that hasn't got a page of its own.
 */
export async function writeOgImages(
  models: Model[],
  providers: string[],
  summaries: ParameterSummaries,
): Promise<number> {
  const details = buildParameterIndex(models);

  await fs.mkdir(DIST_ASSETS_DIR, { recursive: true });
  const home = homeCard(models, providers.length);
  await fs.writeFile(path.join(DIST_ASSETS_DIR, "og.png"), toPng(renderOgCard(home)));

  await writeCard("/", home);
  await writeCard(GLOSSARY_PATH, glossaryCard(details.length));
  await writeCard(API_PATH, apiCard(models.length));

  for (const provider of providers) {
    const providerModels = models.filter((model) => model.provider === provider);
    await writeCard(providerPagePath(provider), providerCard(provider, providerModels));
  }
  for (const detail of details) {
    await writeCard(`/parameters/${detail.slug}`, parameterCard(detail, parameterFacts(detail, summaries)));
  }
  for (const model of models) {
    await writeCard(modelPagePath(model), modelCard(model));
  }

  return 3 + providers.length + details.length + models.length;
}
