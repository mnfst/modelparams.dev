import { describe, expect, it } from "vitest";
import { parseParams, paramsSchema } from "../src/index.js";

const GPT = "openai/gpt-4.1" as const; // max_tokens (int, min 1), temperature (0..2), top_p (0..1)
const HAIKU = "anthropic/claude-haiku-4-5-20251001" as const; // has enum "thinking.type"

describe("parseParams", () => {
  it("accepts valid params and echoes them back", () => {
    const r = parseParams(GPT, { temperature: 0.5, max_tokens: 100 });
    expect(r).toEqual({ success: true, value: { temperature: 0.5, max_tokens: 100 } });
  });

  it("accepts an empty object", () => {
    expect(parseParams(GPT, {})).toEqual({ success: true, value: {} });
  });

  it("rejects an unknown parameter and lists the allowed ones", () => {
    const r = parseParams(GPT, { frequency_penalty: 0.5 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues).toHaveLength(1);
      expect(r.issues[0]?.path).toEqual(["frequency_penalty"]);
      expect(r.issues[0]?.message).toContain("unknown parameter");
      expect(r.issues[0]?.message).toContain("temperature");
    }
  });

  it("enforces numeric ranges", () => {
    const hi = parseParams(GPT, { temperature: 5 });
    expect(hi.success).toBe(false);
    if (!hi.success) expect(hi.issues[0]?.message).toContain("<= 2");

    const lo = parseParams(GPT, { temperature: -1 });
    expect(lo.success).toBe(false);
    if (!lo.success) expect(lo.issues[0]?.message).toContain(">= 0");
  });

  it("requires integers for integer params", () => {
    const r = parseParams(GPT, { max_tokens: 1.5 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.issues[0]?.message).toContain("integer");
  });

  it("rejects the wrong primitive type", () => {
    const r = parseParams(GPT, { temperature: "warm" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.issues[0]?.message).toContain("number");
  });

  it("validates enum membership", () => {
    expect(parseParams(HAIKU, { "thinking.type": "enabled" }).success).toBe(true);
    const bad = parseParams(HAIKU, { "thinking.type": "off" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.issues[0]?.message).toContain("must be one of");
  });

  it("collects every issue, not just the first", () => {
    const r = parseParams(GPT, { temperature: 5, nope: 1 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.issues).toHaveLength(2);
  });

  it("rejects non-object input", () => {
    for (const bad of [null, 42, "x", [1, 2]]) {
      const r = parseParams(GPT, bad);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.issues[0]?.path).toEqual([]);
    }
  });
});

describe.each(["anthropic/claude-fable-5-2", "anthropic/claude-fable-5-2-subscription"] as const)(
  "Fable 5.2 parameter validation for %s",
  (model) => {
    it("accepts all documented effort levels with adaptive thinking", () => {
      for (const effort of ["low", "medium", "high", "xhigh", "max"]) {
        const params = {
          max_tokens: 128000,
          "thinking.display": "summarized",
          "output_config.effort": effort,
        };
        expect(parseParams(model, params)).toEqual({ success: true, value: params });
      }
    });

    it("rejects sampling controls, fixed thinking budgets, and out-of-range output", () => {
      const result = parseParams(model, {
        max_tokens: 128001,
        temperature: 0.2,
        top_p: 0.9,
        top_k: 20,
        "thinking.type": "disabled",
        "thinking.budget_tokens": 2048,
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.issues).toHaveLength(6);
    });
  },
);

describe("paramsSchema (Standard Schema)", () => {
  it("exposes the v1 contract", () => {
    const schema = paramsSchema(GPT);
    expect(schema["~standard"].version).toBe(1);
    expect(schema["~standard"].vendor).toBe("modelparams");
    expect(typeof schema["~standard"].validate).toBe("function");
  });

  it("validate() returns { value } on success", () => {
    const out = paramsSchema(GPT)["~standard"].validate({ temperature: 0.2 });
    expect(out).toEqual({ value: { temperature: 0.2 } });
  });

  it("validate() returns { issues } on failure", () => {
    const out = paramsSchema(GPT)["~standard"].validate({ temperature: 99 });
    expect(out).toHaveProperty("issues");
  });
});
