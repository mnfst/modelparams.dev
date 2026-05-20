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
      path: "stream",
      type: "boolean",
      label: "Stream",
      description: "Stream tokens.",
      default: false,
      group: "output_format",
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

  it("rejects bad param path", () => {
    const result = Model.safeParse({
      ...VALID_MODEL,
      params: [
        { path: "Top-P", type: "number", label: "x", description: "bad", group: "sampling" },
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
    expect(schema.$id).toBe("https://modelparameters.dev/api/v1/schema.json");
    expect(typeof schema.title).toBe("string");
  });
});
