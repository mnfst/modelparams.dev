import { describe, expect, it } from "vitest";
import { MODEL_IDS, resolveByBaseUrl, resolveModelId } from "../src/index.js";

describe("resolveModelId", () => {
  it("passes through a full catalog id", () => {
    const result = resolveModelId("openai/gpt-5.5");
    expect(result).toEqual({ ok: true, id: "openai/gpt-5.5" });
  });

  it("resolves a bare slug published by exactly one provider", () => {
    const result = resolveModelId("gpt-5.5");
    expect(result).toEqual({ ok: true, id: "openai/gpt-5.5" });
  });

  it("resolves a subscription variant", () => {
    const result = resolveModelId("claude-opus-4-7-subscription");
    expect(result).toEqual({ ok: true, id: "anthropic/claude-opus-4-7-subscription" });
  });

  it("trims surrounding whitespace", () => {
    expect(resolveModelId("  gpt-5.5  ")).toEqual({ ok: true, id: "openai/gpt-5.5" });
  });

  it("reports an unknown model with suggestions rather than guessing", () => {
    const result = resolveModelId("gpt-5.5-turbo-ultra");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not_found");
    expect(result.suggestions.length).toBeGreaterThan(0);
    // Suggestions must be real ids the caller can retry with.
    for (const id of result.suggestions) expect(MODEL_IDS).toContain(id);
  });

  it("returns no suggestions for input with nothing in common", () => {
    const result = resolveModelId("zzzzzzzzzz");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not_found");
    expect(result.suggestions).toEqual([]);
  });

  it("never silently picks a winner when a bare slug is ambiguous", () => {
    // Find a slug that more than one provider publishes, if the catalog has one.
    const bySlug = new Map<string, string[]>();
    for (const id of MODEL_IDS) {
      const slug = id.slice(id.indexOf("/") + 1);
      bySlug.set(slug, [...(bySlug.get(slug) ?? []), id]);
    }
    const ambiguous = [...bySlug.entries()].find(([, ids]) => ids.length > 1);
    if (!ambiguous) return; // no collisions in the catalog today

    const [slug, ids] = ambiguous;
    const result = resolveModelId(slug);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("ambiguous");
    expect([...result.matches].sort()).toEqual([...ids].sort());
  });

  it("resolves every catalog id back to itself", () => {
    for (const id of MODEL_IDS) {
      expect(resolveModelId(id), id).toEqual({ ok: true, id });
    }
  });
});

describe("resolveByBaseUrl", () => {
  it("resolves a pathed wire id at its host", () => {
    const r = resolveByBaseUrl(
      "https://api.fireworks.ai/inference/v1",
      "accounts/fireworks/models/kimi-k3",
    );
    expect(r).toEqual({ ok: true, id: "fireworks/kimi-k3", provider: "fireworks" });
  });

  it("matches the origin alone", () => {
    const r = resolveByBaseUrl("https://api.groq.com", "openai/gpt-oss-20b");
    expect(r.ok).toBe(true);
  });

  it("reports an unknown base URL with the known ones", () => {
    const r = resolveByBaseUrl("https://api.nope.dev/v1", "whatever");
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === "unknown_base_url") expect(r.knownBaseUrls.length).toBeGreaterThan(0);
  });

  it("scopes an unknown model to the matched provider", () => {
    const r = resolveByBaseUrl("https://api.moonshot.ai/v1", "kimi-k99");
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === "unknown_model") expect(r.provider).toBe("moonshot");
  });
});
