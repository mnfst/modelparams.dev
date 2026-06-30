// Per-file last-modified dates for the sitemap, read from git so each model URL's
// <lastmod> reflects when its YAML actually changed — not the build time. Falls back
// gracefully (empty map → callers use the build date) when git or history is absent,
// so the build never depends on a full clone.

import { execFileSync } from "node:child_process";
import { authSuffix, type Model } from "../schema/model.js";

/** Repo-relative path of a model's source YAML, e.g. models/openai/gpt-4o.yaml. */
export function modelSourcePath(model: Model): string {
  return `models/${model.provider}/${model.model}${authSuffix(model.authType)}.yaml`;
}

/**
 * Map of repo-relative path → ISO date (YYYY-MM-DD) of the most recent commit that
 * touched it, for everything under models/. One `git log` call; empty on any failure.
 */
export function gitLastmodMap(repoRoot: string): Map<string, string> {
  const map = new Map<string, string>();
  let out: string;
  try {
    out = execFileSync(
      "git",
      ["-C", repoRoot, "log", "--format=%cs", "--name-only", "--", "models"],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
  } catch {
    return map;
  }
  let date = "";
  for (const line of out.split("\n")) {
    const trimmed = line.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      date = trimmed;
    } else if (trimmed && date && !map.has(trimmed)) {
      map.set(trimmed, date);
    }
  }
  return map;
}

/** A model's git lastmod date, or the supplied fallback when unknown. */
export function modelLastmod(model: Model, dates: Map<string, string>, fallback: string): string {
  return dates.get(modelSourcePath(model)) ?? fallback;
}
