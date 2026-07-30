import { MODEL_IDS, type ModelId } from "./generated/model-ids.js";

/** The outcome of {@link resolveModelId}. */
export type ResolveResult =
  | { readonly ok: true; readonly id: ModelId }
  | { readonly ok: false; readonly reason: "not_found"; readonly suggestions: readonly ModelId[] }
  | { readonly ok: false; readonly reason: "ambiguous"; readonly matches: readonly ModelId[] };

function scoreCandidate(candidate: string, query: string): number {
  if (candidate.includes(query)) return 2;
  // Cheap fuzzy fallback: reward shared prefix length so a typo still surfaces
  // near neighbours rather than an empty list.
  let shared = 0;
  while (
    shared < candidate.length &&
    shared < query.length &&
    candidate[shared] === query[shared]
  ) {
    shared += 1;
  }
  return shared >= 4 ? 1 : 0;
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
