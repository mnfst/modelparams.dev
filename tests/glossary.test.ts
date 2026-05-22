import { describe, it, expect } from "vitest";
import { buildGlossary } from "../src/data/glossary.js";
import type { Model } from "../src/schema/model.js";

function model(provider: string, name: string, params: Model["params"]): Model {
  return { provider, authType: "api_key", model: name, params } as Model;
}

const temperature = {
  path: "temperature",
  type: "number",
  label: "Temperature",
  description: "Sampling temperature.",
  group: "sampling",
} as Model["params"][number];

const maxTokens = {
  path: "max_tokens",
  type: "integer",
  label: "Max tokens",
  description: "Output cap.",
  group: "generation_length",
} as Model["params"][number];

describe("buildGlossary", () => {
  it("aggregates one entry per unique path with provider and model counts", () => {
    const models = [
      model("anthropic", "claude", [temperature]),
      model("openai", "gpt", [{ ...temperature, description: "Controls randomness." }]),
      model("openai", "gpt2", [maxTokens]),
    ];

    const groups = buildGlossary(models);
    const sampling = groups.find((g) => g.group === "sampling");
    const tempEntry = sampling?.entries.find((e) => e.path === "temperature");

    expect(tempEntry?.modelCount).toBe(2);
    expect(tempEntry?.providers).toEqual(["anthropic", "openai"]);
    expect(tempEntry?.types).toEqual(["number"]);
  });

  it("orders by schema group order and drops empty groups", () => {
    const groups = buildGlossary([model("anthropic", "c", [maxTokens])]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.group).toBe("generation_length");
  });
});
