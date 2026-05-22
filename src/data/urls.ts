// URL/path helpers for the HTML pages. The JSON API paths under /api/v1 are
// owned by the build pipeline and are not changed here; `modelJsonPath` only
// references the existing endpoint so pages can link to it.

import { modelId, type Model } from "../schema/model.js";

type ModelRef = Pick<Model, "provider" | "model" | "authType">;

/** Canonical HTML page for a single model, e.g. /models/anthropic/claude-opus-4-7. */
export function modelPagePath(model: ModelRef): string {
  return `/models/${modelId(model)}`;
}

/** Provider hub page, e.g. /providers/anthropic. */
export function providerPagePath(provider: string): string {
  return `/providers/${provider}`;
}

/** Parameter glossary page. */
export const GLOSSARY_PATH = "/glossary";

/** Existing JSON API endpoint for a model (unchanged; referenced for linking). */
export function modelJsonPath(model: ModelRef): string {
  return `/api/v1/models/${modelId(model)}.json`;
}

/** Join the site origin with a root-relative path. */
export function absolute(siteUrl: string, pathname: string): string {
  return `${siteUrl}${pathname}`;
}
