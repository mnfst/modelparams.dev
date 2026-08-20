import { describe, expect, it } from "vitest";
import { modelId, searchCatalog } from "../src/client/webmcp.js";

type AuthType = "api_key" | "subscription";

function model(provider: string, name: string, authType: AuthType, paths: string[]) {
  return {
    provider,
    model: name,
    authType,
    params: paths.map((path) => ({
      path,
      type: "number",
      group: "sampling",
      description: "",
    })),
  };
}

function catalog(...models: ReturnType<typeof model>[]) {
  return { count: models.length, models };
}

const CATALOG = catalog(
  model("anthropic", "claude-opus-4-7", "api_key", ["temperature", "thinking.type", "max_tokens"]),
  model("anthropic", "claude-opus-4-7", "subscription", ["temperature", "thinking.type"]),
  model("openai", "gpt-4o", "api_key", ["temperature", "top_p"]),
  model("deepseek", "deepseek-chat", "api_key", ["temperature"]),
);

describe("modelId", () => {
  it("leaves api_key models bare", () => {
    expect(modelId(model("openai", "gpt-4o", "api_key", []))).toBe("openai/gpt-4o");
  });

  it("suffixes subscription models", () => {
    expect(modelId(model("anthropic", "claude-opus-4-7", "subscription", []))).toBe(
      "anthropic/claude-opus-4-7-subscription",
    );
  });
});

describe("searchCatalog", () => {
  it("returns every model when no filters are given", () => {
    const result = searchCatalog(CATALOG, {});
    expect(result.total).toBe(4);
    expect(result.returned).toBe(4);
    expect(result.truncated).toBe(false);
  });

  it("matches free-text query case-insensitively on name, provider, or id", () => {
    expect(searchCatalog(CATALOG, { query: "opus" }).total).toBe(2);
    expect(searchCatalog(CATALOG, { query: "OPUS" }).total).toBe(2);
    expect(searchCatalog(CATALOG, { query: "openai" }).total).toBe(1);
    expect(searchCatalog(CATALOG, { query: "nonsense" }).total).toBe(0);
  });

  it("filters by provider slug", () => {
    const result = searchCatalog(CATALOG, { provider: "anthropic" });
    expect(result.total).toBe(2);
    expect(result.models.every((m) => m.provider === "anthropic")).toBe(true);
  });

  it("requires the model to expose every requested capability", () => {
    expect(searchCatalog(CATALOG, { capability: "thinking.type" }).total).toBe(2);
    expect(searchCatalog(CATALOG, { capability: ["thinking.type", "max_tokens"] }).total).toBe(1);
    expect(searchCatalog(CATALOG, { capability: "does.not.exist" }).total).toBe(0);
  });

  it("filters by auth type and treats `all` as no filter", () => {
    expect(searchCatalog(CATALOG, { auth: "subscription" }).total).toBe(1);
    expect(searchCatalog(CATALOG, { auth: "api_key" }).total).toBe(3);
    expect(searchCatalog(CATALOG, { auth: "all" }).total).toBe(4);
  });

  it("combines filters (AND semantics)", () => {
    const result = searchCatalog(CATALOG, { provider: "anthropic", auth: "api_key" });
    expect(result.total).toBe(1);
    expect(result.models[0]?.id).toBe("anthropic/claude-opus-4-7");
  });

  it("caps results at the limit and flags truncation", () => {
    const result = searchCatalog(CATALOG, { limit: 1 });
    expect(result.total).toBe(4);
    expect(result.returned).toBe(1);
    expect(result.truncated).toBe(true);
    expect(result.models).toHaveLength(1);
  });

  it("clamps a non-positive limit to at least one result", () => {
    expect(searchCatalog(CATALOG, { limit: 0 }).models).toHaveLength(1);
  });

  it("returns id, auth, and parameter paths for each match", () => {
    const sub = searchCatalog(CATALOG, { auth: "subscription" }).models[0];
    expect(sub).toMatchObject({
      id: "anthropic/claude-opus-4-7-subscription",
      provider: "anthropic",
      authType: "subscription",
      parameterCount: 2,
    });
    expect(sub?.parameters).toEqual(["temperature", "thinking.type"]);
  });
});
