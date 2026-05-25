import { describe, it, expect } from "vitest";
import { Model, modelId, authSuffix } from "../src/schema/model.js";
import { buildModelJsonSchema } from "../src/schema/generate.js";

const VALID_MODEL = {
  provider: "anthropic",
  authType: "api_key",
  model: "claude-opus-4-7",
  params: [
    {
      path: "temperature",
      type: "number",
      label: "Temperature",
      description: "Sampling temperature.",
      default: 1.0,
      range: { min: 0, max: 1, step: 0.1 },
      group: "sampling",
    },
    {
      path: "logprobs",
      type: "boolean",
      label: "Log probabilities",
      description: "Return log probabilities of output tokens.",
      default: false,
      group: "observability",
    },
  ],
};

describe("Model schema", () => {
  it("accepts a valid model", () => {
    const result = Model.safeParse(VALID_MODEL);
    expect(result.success).toBe(true);
  });

  it("rejects unknown authType", () => {
    const result = Model.safeParse({ ...VALID_MODEL, authType: "free" });
    expect(result.success).toBe(false);
  });

  it("accepts provider-native model ids with dots", () => {
    const result = Model.safeParse({ ...VALID_MODEL, provider: "openai", model: "gpt-4.1" });
    expect(result.success).toBe(true);
  });

  it("accepts provider-native model ids with uppercase characters", () => {
    const result = Model.safeParse({ ...VALID_MODEL, provider: "minimax", model: "MiniMax-M2.7" });
    expect(result.success).toBe(true);
  });

  it("rejects path separators in model ids", () => {
    const result = Model.safeParse({
      ...VALID_MODEL,
      provider: "deepseek",
      model: "deepseek/deepseek-chat",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown top-level fields", () => {
    const result = Model.safeParse({ ...VALID_MODEL, metadata: { source: "docs" } });
    expect(result.success).toBe(false);
  });

  it("rejects parameter with unknown type", () => {
    const result = Model.safeParse({
      ...VALID_MODEL,
      params: [{ path: "x", type: "tensor", label: "X", description: "bad", group: "sampling" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts integer type as distinct from number", () => {
    const result = Model.safeParse({
      ...VALID_MODEL,
      params: [
        {
          path: "max_tokens",
          type: "integer",
          label: "Max tokens",
          description: "x",
          default: 4096,
          range: { min: 1 },
          group: "generation_length",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("requires values on enum parameters", () => {
    const result = Model.safeParse({
      ...VALID_MODEL,
      params: [
        {
          path: "mode",
          type: "enum",
          label: "Mode",
          description: "missing values",
          group: "sampling",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts provider API paths with native casing", () => {
    const result = Model.safeParse({
      ...VALID_MODEL,
      provider: "google",
      model: "gemini-3.5-flash",
      params: [
        {
          path: "generationConfig.thinkingConfig.thinkingLevel",
          type: "enum",
          label: "Thinking level",
          description: "x",
          values: ["low", "medium", "high"],
          group: "reasoning",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects bad param path", () => {
    const result = Model.safeParse({
      ...VALID_MODEL,
      params: [
        { path: "Top-P", type: "number", label: "x", description: "bad", group: "sampling" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects API-level capabilities as params", () => {
    const result = Model.safeParse({
      ...VALID_MODEL,
      params: [
        {
          path: "stream",
          type: "boolean",
          label: "Stream",
          description: "Streaming is configured at request/API level.",
          default: false,
          group: "output_format",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown parameter fields", () => {
    const result = Model.safeParse({
      ...VALID_MODEL,
      params: [
        {
          path: "temperature",
          type: "number",
          label: "Temperature",
          description: "x",
          group: "sampling",
          ui: { control: "slider" },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts dot-notation param paths", () => {
    const result = Model.safeParse({
      ...VALID_MODEL,
      params: [
        {
          path: "thinking.type",
          type: "enum",
          label: "Thinking mode",
          description: "x",
          values: ["disabled", "enabled"],
          group: "reasoning",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts applicability with only and except", () => {
    const result = Model.safeParse({
      ...VALID_MODEL,
      params: [
        {
          path: "thinking.budget_tokens",
          type: "integer",
          label: "Budget",
          description: "x",
          group: "reasoning",
          applicability: {
            only: { "thinking.type": "enabled" },
            except: [{ temperature: { not: 1 } }],
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts provider API paths in applicability rules", () => {
    const result = Model.safeParse({
      ...VALID_MODEL,
      provider: "google",
      model: "gemini-3.5-flash",
      params: [
        {
          path: "generationConfig.thinkingConfig.includeThoughts",
          type: "boolean",
          label: "Include thoughts",
          description: "x",
          group: "reasoning",
          applicability: {
            except: { "generationConfig.thinkingConfig.thinkingLevel": "minimal" },
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown applicability operators", () => {
    const result = Model.safeParse({
      ...VALID_MODEL,
      params: [
        {
          path: "top_p",
          type: "number",
          label: "Top P",
          description: "x",
          group: "sampling",
          applicability: { except: [{ temperature: { gte: 1 } }] },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty applicability arrays and match objects", () => {
    const emptyArray = Model.safeParse({
      ...VALID_MODEL,
      params: [
        {
          path: "top_p",
          type: "number",
          label: "Top P",
          description: "x",
          group: "sampling",
          applicability: { except: [] },
        },
      ],
    });
    const emptyMatch = Model.safeParse({
      ...VALID_MODEL,
      params: [
        {
          path: "top_p",
          type: "number",
          label: "Top P",
          description: "x",
          group: "sampling",
          applicability: { except: {} },
        },
      ],
    });

    expect(emptyArray.success).toBe(false);
    expect(emptyMatch.success).toBe(false);
  });

  it("rejects enum defaults outside values", () => {
    const result = Model.safeParse({
      ...VALID_MODEL,
      params: [
        {
          path: "reasoning_effort",
          type: "enum",
          label: "Reasoning effort",
          description: "x",
          default: "ultra",
          values: ["low", "medium", "high"],
          group: "reasoning",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects range where max < min", () => {
    const result = Model.safeParse({
      ...VALID_MODEL,
      params: [
        {
          path: "max_tokens",
          type: "integer",
          label: "Max",
          description: "x",
          range: { min: 100, max: 10 },
          group: "generation_length",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("modelId / authSuffix", () => {
  it("derives id from provider/model/authType (no suffix for api_key)", () => {
    expect(modelId({ provider: "anthropic", model: "claude-opus-4-7", authType: "api_key" })).toBe(
      "anthropic/claude-opus-4-7",
    );
    expect(modelId({ provider: "openai", model: "gpt-4o", authType: "subscription" })).toBe(
      "openai/gpt-4o-subscription",
    );
  });

  it("authSuffix returns empty for api_key, -subscription otherwise", () => {
    expect(authSuffix("api_key")).toBe("");
    expect(authSuffix("subscription")).toBe("-subscription");
  });
});

describe("JSON Schema generator", () => {
  it("produces a draft-07 schema with $id", () => {
    const schema = buildModelJsonSchema();
    expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(schema.$id).toBe("https://modelparams.dev/api/v1/schema.json");
    expect(typeof schema.title).toBe("string");
  });
});
