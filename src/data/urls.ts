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

/** Parameter glossary page — the hub that links out to each parameter page. */
export const GLOSSARY_PATH = "/glossary";

/**
 * URL-safe slug for a parameter path: lowercased, with nested-path dots turned into
 * hyphens, e.g. `thinking.type` → `thinking-type`. Underscores are kept so that
 * `top_p` stays `top_p` and a dotted path never collides with its snake_case twin
 * (e.g. `reasoning.effort` → `reasoning-effort` vs `reasoning_effort`).
 */
export function parameterSlug(path: string): string {
  return path
    .toLowerCase()
    .replace(/\./g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Canonical HTML page for a single parameter, e.g. /parameters/temperature. */
export function parameterPagePath(path: string): string {
  return `/parameters/${parameterSlug(path)}`;
}

/** In-page anchor id for a parameter row on a model page, e.g. param-top-p. */
export function parameterAnchorId(path: string): string {
  return `param-${parameterSlug(path)}`;
}

/** Existing JSON API endpoint for a model (unchanged; referenced for linking). */
export function modelJsonPath(model: ModelRef): string {
  return `/api/v1/models/${modelId(model)}.json`;
}

/** Join the site origin with a root-relative path. */
export function absolute(siteUrl: string, pathname: string): string {
  return `${siteUrl}${pathname}`;
}
