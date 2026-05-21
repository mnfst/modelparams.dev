import { describe, expect, it } from "vitest";
import { buildParamIndex, findRemovedParams } from "../src/data/removals.js";
import type { AuthType, Model, Parameter } from "../src/schema/model.js";

function param(path: string): Parameter {
  return { path, type: "number", label: "L", description: "d", group: "sampling" };
}

function model(provider: string, authType: AuthType, name: string, paths: string[]): Model {
  return { provider, authType, model: name, params: paths.map(param) };
}

describe("findRemovedParams", () => {
  it("flags a parameter removed from a model that still exists", () => {
    const base = [model("anthropic", "api_key", "opus", ["max_tokens", "temperature"])];
    const current = [model("anthropic", "api_key", "opus", ["max_tokens"])];

    expect(findRemovedParams(base, current)).toEqual([
      { modelId: "anthropic/opus", path: "temperature" },
    ]);
  });

  it("treats a renamed parameter path as a removal", () => {
    const base = [model("openai", "api_key", "gpt", ["max_tokens"])];
    const current = [model("openai", "api_key", "gpt", ["maxTokens"])];

    expect(findRemovedParams(base, current)).toEqual([
      { modelId: "openai/gpt", path: "max_tokens" },
    ]);
  });

  it("does not flag newly added parameters", () => {
    const base = [model("openai", "api_key", "gpt", ["max_tokens"])];
    const current = [model("openai", "api_key", "gpt", ["max_tokens", "temperature"])];

    expect(findRemovedParams(base, current)).toEqual([]);
  });

  it("does not flag a whole model that was removed (out of scope by policy)", () => {
    const base = [
      model("anthropic", "api_key", "opus", ["max_tokens"]),
      model("anthropic", "api_key", "haiku", ["temperature"]),
    ];
    const current = [model("anthropic", "api_key", "opus", ["max_tokens"])];

    expect(findRemovedParams(base, current)).toEqual([]);
  });

  it("does not flag a brand-new model", () => {
    const base = [model("openai", "api_key", "gpt", ["max_tokens"])];
    const current = [
      model("openai", "api_key", "gpt", ["max_tokens"]),
      model("openai", "api_key", "gpt-mini", ["temperature"]),
    ];

    expect(findRemovedParams(base, current)).toEqual([]);
  });

  it("does not care about parameter ordering", () => {
    const base = [model("openai", "api_key", "gpt", ["a", "b", "c"])];
    const current = [model("openai", "api_key", "gpt", ["c", "a", "b"])];

    expect(findRemovedParams(base, current)).toEqual([]);
  });

  it("treats api_key and subscription as separate models", () => {
    const base = [
      model("anthropic", "api_key", "opus", ["temperature"]),
      model("anthropic", "subscription", "opus", ["temperature"]),
    ];
    const current = [
      model("anthropic", "api_key", "opus", ["temperature"]),
      model("anthropic", "subscription", "opus", []),
    ];

    expect(findRemovedParams(base, current)).toEqual([
      { modelId: "anthropic/opus-subscription", path: "temperature" },
    ]);
  });

  it("reports multiple removals sorted by model id then path", () => {
    const base = [
      model("openai", "api_key", "gpt", ["a", "z"]),
      model("anthropic", "api_key", "opus", ["m", "n"]),
    ];
    const current = [
      model("openai", "api_key", "gpt", ["a"]),
      model("anthropic", "api_key", "opus", ["m"]),
    ];

    expect(findRemovedParams(base, current)).toEqual([
      { modelId: "anthropic/opus", path: "n" },
      { modelId: "openai/gpt", path: "z" },
    ]);
  });
});

describe("buildParamIndex", () => {
  it("collects parameter paths per model id", () => {
    const index = buildParamIndex([model("openai", "api_key", "gpt", ["a", "b"])]);
    expect(index.get("openai/gpt")).toEqual(new Set(["a", "b"]));
  });
});
