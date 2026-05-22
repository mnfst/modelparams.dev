import { describe, it, expect } from "vitest";
import { modelPageDescription, modelPageTitle } from "../src/build/render-model.js";
import { providerPageDescription, providerPageTitle } from "../src/build/render-provider.js";
import { modelJsonPath, modelPagePath, providerPagePath } from "../src/data/urls.js";
import type { Model } from "../src/schema/model.js";

function model(over: Partial<Model> = {}): Model {
  return {
    provider: "anthropic",
    authType: "api_key",
    model: "claude-opus-4-7",
    params: [
      {
        path: "temperature",
        type: "number",
        label: "Temperature",
        description: "x",
        group: "sampling",
      },
    ],
    ...over,
  } as Model;
}

describe("url helpers", () => {
  it("builds page and JSON paths from the model id", () => {
    expect(modelPagePath(model())).toBe("/models/anthropic/claude-opus-4-7");
    expect(modelPagePath(model({ authType: "subscription" }))).toBe(
      "/models/anthropic/claude-opus-4-7-subscription",
    );
    expect(modelJsonPath(model())).toBe("/api/v1/models/anthropic/claude-opus-4-7.json");
    expect(providerPagePath("openai")).toBe("/providers/openai");
  });
});

describe("model page meta", () => {
  it("titles api-key and subscription variants distinctly", () => {
    expect(modelPageTitle(model())).toBe("Anthropic Claude Opus 4.7 parameters · modelparams.dev");
    expect(modelPageTitle(model({ authType: "subscription" }))).toContain("(subscription)");
  });

  it("summarizes the parameter set in the description", () => {
    const desc = modelPageDescription(model());
    expect(desc).toContain("Anthropic Claude Opus 4.7");
    expect(desc).toContain("temperature");
  });
});

describe("provider page meta", () => {
  it("names the provider and counts its models", () => {
    expect(providerPageTitle("anthropic")).toBe("Anthropic model parameters · modelparams.dev");
    expect(providerPageDescription("anthropic", [model(), model()])).toContain(
      "2 Anthropic models",
    );
  });
});
