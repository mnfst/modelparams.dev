import { describe, it, expect } from "vitest";
import { buildCapabilityFacets, buildCatalog, uniqueProviders } from "../src/data/catalog.js";
import { describeApplicability } from "../src/data/applicability.js";
import { modelLabel, providerLabel } from "../src/data/display.js";
import { loadAllModels } from "../src/data/load.js";
import { modelId } from "../src/schema/model.js";
import type { Model } from "../src/schema/model.js";

function makeModel(overrides: Partial<Model> = {}): Model {
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
        default: 1,
        group: "sampling",
      },
      {
        path: "logprobs",
        type: "boolean",
        label: "Log probabilities",
        description: "y",
        default: false,
        group: "observability",
      },
    ],
    ...overrides,
  } as Model;
}

describe("buildCatalog", () => {
  it("wraps models with metadata", () => {
    const catalog = buildCatalog([makeModel()]);
    expect(catalog.count).toBe(1);
    expect(catalog.models).toHaveLength(1);
    expect(catalog.$schema).toBe("https://modelparams.dev/api/v1/schema.json");
    expect(typeof catalog.generatedAt).toBe("string");
  });
});

describe("buildCapabilityFacets", () => {
  it("counts unique parameter paths across models, sorted by frequency", () => {
    const m1 = makeModel();
    const m2 = makeModel({
      provider: "openai",
      model: "gpt-4o",
      params: [
        { path: "temperature", type: "number", label: "T", description: "x", group: "sampling" },
        { path: "top_p", type: "number", label: "P", description: "y", group: "sampling" },
      ],
    });
    const facets = buildCapabilityFacets([m1, m2]);
    expect(facets[0]).toEqual({ path: "temperature", count: 2 });
    expect(facets.map((f) => f.path)).toContain("logprobs");
    expect(facets.map((f) => f.path)).toContain("top_p");
  });
});

describe("uniqueProviders", () => {
  it("returns sorted unique providers", () => {
    const result = uniqueProviders([
      makeModel({ provider: "openai" }),
      makeModel({ provider: "anthropic" }),
      makeModel({ provider: "openai", model: "gpt-4o" }),
    ]);
    expect(result).toEqual(["anthropic", "openai"]);
  });
});

describe("display helpers", () => {
  it("knows the canonical provider names", () => {
    expect(providerLabel("anthropic")).toBe("Anthropic");
    expect(providerLabel("openai")).toBe("OpenAI");
    expect(providerLabel("xai")).toBe("xAI");
  });

  it("uses overrides for known model display names", () => {
    expect(modelLabel({ provider: "openai", model: "gpt-4o" })).toBe("GPT-4o");
    expect(modelLabel({ provider: "openai", model: "o3-mini" })).toBe("o3-mini");
  });

  it("title-cases unknown model slugs and joins versions with dots", () => {
    expect(modelLabel({ provider: "anthropic", model: "claude-sonnet-4-6" })).toBe(
      "Claude Sonnet 4.6",
    );
  });
});

describe("describeApplicability", () => {
  it("returns empty arrays when no applicability", () => {
    expect(describeApplicability(undefined)).toEqual({ only: [], except: [] });
  });

  it("formats only rules", () => {
    const out = describeApplicability({ only: { "thinking.type": "enabled" } });
    expect(out.only).toEqual(['thinking.type = "enabled"']);
    expect(out.except).toEqual([]);
  });

  it("formats except with array values using ∈", () => {
    const out = describeApplicability({
      except: { "thinking.type": ["adaptive", "enabled"] },
    });
    expect(out.except[0]).toContain("thinking.type");
    expect(out.except[0]).toContain("∈");
  });

  it("formats `not` expressions with ≠", () => {
    const out = describeApplicability({ except: [{ temperature: { not: 1 } }] });
    expect(out.except[0]).toBe("temperature ≠ 1");
  });
});

describe("provider catalog rows", () => {
  it("keeps Z.ai Coding Plan params aligned with the API-key rows", async () => {
    const { models, issues } = await loadAllModels();
    expect(issues).toEqual([]);

    const byId = new Map(models.map((model) => [modelId(model), model]));
    const sharedModels = [
      "glm-5.1",
      "glm-5-turbo",
      "glm-5",
      "glm-4.7",
      "glm-4.6",
      "glm-4.5",
      "glm-4.5-air",
    ];

    for (const model of sharedModels) {
      const apiKey = byId.get(`z-ai/${model}`);
      const subscription = byId.get(`z-ai/${model}-subscription`);

      expect(subscription?.params.map((param) => param.path)).toEqual(
        apiKey?.params.map((param) => param.path),
      );
    }
  });
});
