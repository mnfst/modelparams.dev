import { MODEL_IDS, type ModelId } from "./generated/model-ids.js";

/** The outcome of {@link resolveModelId}. */
export type ResolveResult =
  | { readonly ok: true; readonly id: ModelId }
  | { readonly ok: false; readonly reason: "not_found"; readonly suggestions: readonly ModelId[] }
  | { readonly ok: false; readonly reason: "ambiguous"; readonly matches: readonly ModelId[] };

function sharedPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
}

/**
 * Rank a catalog id against an unresolvable query so the caller gets usable
 * near-misses instead of an empty list.
 *
 * Scored against the bare model slug as well as the full id. A query like
 * `gpt-5.5-turbo-ultra` shares no prefix with `openai/gpt-5.5` because the
 * provider gets in the way, but it does contain that model's slug, and that is
 * the match worth surfacing.
 */
function scoreCandidate(id: string, query: string): number {
  const slug = id.slice(id.indexOf("/") + 1);
  // A slash means the caller is already thinking in qualified ids, so don't let
  // a bare slug outrank the full form.
  const targets = query.includes("/") ? [id] : [slug, id];

  let best = 0;
  for (const target of targets) {
    if (target === query) {
      best = Math.max(best, 4);
    } else if (target.includes(query) || (target.length >= 4 && query.includes(target))) {
      best = Math.max(best, 3);
    } else if (sharedPrefixLength(target, query) >= 4) {
      best = Math.max(best, 1);
    }
  }
  return best;
}

/**
 * Resolve a user-supplied model reference to a catalog id.
 *
 * Accepts a full `provider/model` id, or a bare provider-native model slug
 * (`claude-opus-4-7`) when exactly one provider publishes it. A bare slug that
 * several providers publish is reported as ambiguous rather than guessed at.
 *
 * @example
 * resolveModelId("gpt-5.5");                    // → { ok: true, id: "openai/gpt-5.5" }
 * resolveModelId("anthropic/claude-opus-4-7");  // → { ok: true, id: "anthropic/claude-opus-4-7" }
 */
export function resolveModelId(input: string): ResolveResult {
  const query = input.trim();
  if (MODEL_IDS.includes(query as ModelId)) {
    return { ok: true, id: query as ModelId };
  }

  if (!query.includes("/")) {
    const matches = MODEL_IDS.filter((id) => id.slice(id.indexOf("/") + 1) === query);
    if (matches.length === 1) return { ok: true, id: matches[0]! };
    if (matches.length > 1) return { ok: false, reason: "ambiguous", matches };
  }

  const needle = query.toLowerCase();
  const suggestions = MODEL_IDS.map((id) => ({
    id,
    score: scoreCandidate(id.toLowerCase(), needle),
  }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 5)
    .map((c) => c.id);

  return { ok: false, reason: "not_found", suggestions };
}
