import { describe, it, expect } from "vitest";
import { buildParameterIndex, modelsWithoutParameter } from "../src/data/parameters.js";
import { parameterPagePath, parameterSlug } from "../src/data/urls.js";
import type { Model } from "../src/schema/model.js";

function model(
  provider: string,
  name: string,
  params: Model["params"],
  authType: Model["authType"] = "api_key",
): Model {
  return { provider, authType, model: name, params } as Model;
}

const topP = {
  path: "top_p",
  type: "number",
  label: "Top P",
  description: "Nucleus sampling.",
  group: "sampling",
} as Model["params"][number];

const maxTokens = {
  path: "max_tokens",
  type: "integer",
  label: "Max tokens",
  description: "Output cap.",
  group: "generation_length",
} as Model["params"][number];

function temperature(over: Record<string, unknown> = {}): Model["params"][number] {
  return {
    path: "temperature",
    type: "number",
    label: "Temperature",
    description: "Controls randomness.",
    group: "sampling",
    ...over,
  } as Model["params"][number];
}

describe("parameterSlug / parameterPagePath", () => {
  it("turns nested-path dots into hyphens but keeps underscores", () => {
    expect(parameterSlug("temperature")).toBe("temperature");
    expect(parameterSlug("top_p")).toBe("top_p");
    expect(parameterSlug("thinking.type")).toBe("thinking-type");
    expect(parameterSlug("max_completion_tokens")).toBe("max_completion_tokens");
    expect(parameterPagePath("top_p")).toBe("/parameters/top_p");
  });

  it("keeps a dotted path distinct from its snake_case twin", () => {
    expect(parameterSlug("reasoning.effort")).toBe("reasoning-effort");
    expect(parameterSlug("reasoning_effort")).toBe("reasoning_effort");
  });
});

describe("buildParameterIndex", () => {
  const models = [
    model("openai", "gpt-4o", [
      temperature({ default: 1, range: { min: 0, max: 2 } }),
      topP,
      maxTokens,
    ]),
    model("anthropic", "claude", [temperature({ default: 1, range: { min: 0, max: 1 } })]),
  ];
  const index = buildParameterIndex(models);

  it("produces one detail per unique path with a slug and model count", () => {
    const temp = index.find((d) => d.path === "temperature");
    expect(temp?.slug).toBe("temperature");
    expect(temp?.modelCount).toBe(2);
    expect(temp?.providers).toEqual(["anthropic", "openai"]);
    expect(temp?.usages).toHaveLength(2);
  });

  it("keeps each model's own constraints in its usage", () => {
    const temp = index.find((d) => d.path === "temperature")!;
    const openai = temp.usages.find((u) => u.provider === "openai");
    const anthropic = temp.usages.find((u) => u.provider === "anthropic");
    expect(openai?.param.type === "number" && openai.param.range).toEqual({ min: 0, max: 2 });
    expect(anthropic?.param.type === "number" && anthropic.param.range).toEqual({ min: 0, max: 1 });
  });

  it("orders by schema group, then by how many models expose the parameter", () => {
    expect(index[0]?.group).toBe("generation_length");
    const sampling = index.filter((d) => d.group === "sampling").map((d) => d.path);
    expect(sampling).toEqual(["temperature", "top_p"]);
  });
});

describe("modelsWithoutParameter", () => {
  it("lists models that don't document the parameter, grouped by provider", () => {
    const models = [
      model("openai", "gpt-4o", [temperature(), topP]),
      model("anthropic", "claude", [temperature()]),
    ];
    const topPDetail = buildParameterIndex(models).find((d) => d.path === "top_p")!;
    const without = modelsWithoutParameter(topPDetail, models);
    const anthropic = without.find((g) => g.provider === "anthropic");
    expect(anthropic?.models.map((m) => m.model)).toContain("claude");
    expect(without.find((g) => g.provider === "openai")).toBeUndefined();
  });
});
