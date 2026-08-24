import { describe, expect, it } from "vitest";
import {
  checkApplicability,
  dropUnsupported,
  getDefaults,
  getModel,
  getParam,
  isApplicable,
  MODEL_IDS,
  parseParams,
  type Param,
} from "../src/index.js";

// These fixtures are real catalog entries, picked because they carry the rule
// shapes the engine has to handle. If the catalog changes shape under them the
// assertions below should fail loudly rather than silently stop testing
// anything — hence the guards.
const OPUS_3 = "anthropic/claude-3-opus-20240229";
const OPUS_47 = "anthropic/claude-opus-4-7";

describe("catalog fixtures still carry the rules under test", () => {
  it("claude-3-opus top_p is gated on temperature", () => {
    const top_p = getParam(OPUS_3, "top_p") as Param | undefined;
    expect(top_p?.applicability?.except).toBeDefined();
  });

  it("claude-opus-4-7 thinking.display is gated on thinking.type", () => {
    const display = getParam(OPUS_47, "thinking.display") as Param | undefined;
    expect(display?.applicability?.only).toBeDefined();
  });
});

describe("checkApplicability", () => {
  it("flags top_p when temperature is moved off its default", () => {
    const issues = checkApplicability(OPUS_3, { temperature: 0.5, top_p: 0.9 });
    expect(issues.map((i) => i.path)).toContain("top_p");
    const conflict = issues.find((i) => i.path === "top_p");
    expect(conflict?.conflictsWith).toContain("temperature");
    expect(conflict?.message).toMatch(/temperature/);
  });

  it("allows top_p when temperature is left at its default", () => {
    expect(checkApplicability(OPUS_3, { top_p: 0.9 })).toEqual([]);
  });

  it("allows top_p when temperature is explicitly set to the permitted value", () => {
    expect(checkApplicability(OPUS_3, { temperature: 1, top_p: 0.9 })).toEqual([]);
  });

  it("ignores parameters the request never supplied", () => {
    // temperature conflicts with top_p, but top_p isn't in the request.
    expect(checkApplicability(OPUS_3, { temperature: 0.5 })).toEqual([]);
  });

  it("reports an `only` rule when the gating parameter has the wrong value", () => {
    const display = getParam(OPUS_47, "thinking.display") as Param;
    const allowed = (display.applicability?.only as { "thinking.type": string[] })["thinking.type"];
    const thinkingType = getParam(OPUS_47, "thinking.type") as Param;
    const disallowed = (thinkingType.values ?? []).find((v) => !allowed.includes(v as string));
    expect(disallowed).toBeDefined();

    const issues = checkApplicability(OPUS_47, {
      "thinking.type": disallowed,
      "thinking.display": display.values?.[0],
    });
    expect(issues.map((i) => i.path)).toContain("thinking.display");
    expect(issues.find((i) => i.path === "thinking.display")?.message).toMatch(/only applies when/);
  });

  it("accepts an `only` rule when the gating parameter matches", () => {
    const display = getParam(OPUS_47, "thinking.display") as Param;
    const allowed = (display.applicability?.only as { "thinking.type": string[] })["thinking.type"];
    const issues = checkApplicability(OPUS_47, {
      "thinking.type": allowed[0],
      "thinking.display": display.values?.[0],
    });
    expect(issues.map((i) => i.path)).not.toContain("thinking.display");
  });

  it("returns nothing for a model with no applicability rules", () => {
    const plain = getModel("openai/gpt-5.5").params as readonly Param[];
    expect(plain.every((p) => !p.applicability)).toBe(true);
    expect(checkApplicability("openai/gpt-5.5", { reasoning_effort: "low" })).toEqual([]);
  });
});

describe("isApplicable", () => {
  it("is true for a parameter with no rules", () => {
    expect(isApplicable(OPUS_3, "max_tokens", {})).toBe(true);
  });

  it("is true for a parameter the model doesn't declare", () => {
    expect(isApplicable(OPUS_3, "frequency_penalty", {})).toBe(true);
  });

  it("tracks the surrounding request", () => {
    expect(isApplicable(OPUS_3, "top_p", { temperature: 1 })).toBe(true);
    expect(isApplicable(OPUS_3, "top_p", { temperature: 0.2 })).toBe(false);
  });

  it("defaults to the catalog value when the gating parameter is absent", () => {
    // claude-3-opus defaults temperature to 1, which is what the rule permits.
    expect(getParam(OPUS_3, "temperature")?.default).toBe(1);
    expect(isApplicable(OPUS_3, "top_p", {})).toBe(true);
  });
});

describe("parseParams enforces applicability", () => {
  it("rejects a conflicting combination", () => {
    const result = parseParams(OPUS_3, { temperature: 0.5, top_p: 0.9 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.some((i) => i.path[0] === "top_p")).toBe(true);
  });

  it("still accepts a valid combination", () => {
    const result = parseParams(OPUS_3, { temperature: 1, top_p: 0.9 });
    expect(result.success).toBe(true);
  });

  it("reports the range error rather than a conflict when a value is out of range", () => {
    const result = parseParams(OPUS_3, { temperature: 99, top_p: 0.9 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.path[0]).toBe("temperature");
  });
});

describe("dropUnsupported", () => {
  it("drops a parameter the model doesn't accept", () => {
    const { params, dropped } = dropUnsupported("openai/gpt-5.5", {
      temperature: 0.7,
      reasoning_effort: "low",
    });
    expect(params).toEqual({ reasoning_effort: "low" });
    expect(dropped.map((d) => d.path)).toEqual(["temperature"]);
  });

  it("drops the conflicting parameter, keeping the rest of the request", () => {
    const { params, dropped } = dropUnsupported(OPUS_3, {
      temperature: 0.5,
      top_p: 0.9,
      max_tokens: 1024,
    });
    expect(params).toEqual({ temperature: 0.5, max_tokens: 1024 });
    expect(dropped.map((d) => d.path)).toEqual(["top_p"]);
    expect(dropped[0]?.value).toBe(0.9);
    expect(dropped[0]?.reason).toMatch(/temperature/);
  });

  it("drops values that fail their own constraint", () => {
    const { params, dropped } = dropUnsupported(OPUS_3, { temperature: 99, max_tokens: 512 });
    expect(params).toEqual({ max_tokens: 512 });
    expect(dropped.map((d) => d.path)).toEqual(["temperature"]);
  });

  it("leaves a already-valid request untouched", () => {
    const input = { max_tokens: 1024, temperature: 1 };
    const { params, dropped } = dropUnsupported(OPUS_3, input);
    expect(params).toEqual(input);
    expect(dropped).toEqual([]);
  });

  it("always returns a request that parses clean", () => {
    const { params } = dropUnsupported(OPUS_3, {
      temperature: 0.5,
      top_p: 0.9,
      top_k: 40,
      nonsense: true,
    });
    expect(parseParams(OPUS_3, params).success).toBe(true);
  });
});

describe("a gated parameter set without opening its gate", () => {
  // The catalog gives thinking.budget_tokens a default *and* gates it on
  // thinking.type — the default describes the budget used once thinking is on,
  // not a value that is always live. Passing the budget without enabling
  // thinking is a silent no-op at the provider, so it should be reported.
  const GATED = "anthropic/claude-3-7-sonnet-20250219";

  it("is reported", () => {
    const issues = checkApplicability(GATED, { "thinking.budget_tokens": 8000 });
    expect(issues.map((i) => i.path)).toContain("thinking.budget_tokens");
  });

  it("is accepted once the gate is open", () => {
    const issues = checkApplicability(GATED, {
      "thinking.type": "enabled",
      "thinking.budget_tokens": 8000,
    });
    expect(issues).toEqual([]);
  });
});

describe("the whole catalog", () => {
  it("converges: dropUnsupported always yields a request that parses clean", () => {
    // Guards the fixed-point loop in dropUnsupported against both
    // non-termination and emitting output it would itself reject.
    for (const id of MODEL_IDS) {
      const { params } = dropUnsupported(id, { ...getDefaults(id) });
      const result = parseParams(id, params);
      expect(
        result.success,
        `${id}: ${result.success ? "" : result.issues.map((i) => i.message).join("; ")}`,
      ).toBe(true);
    }
  });

  it("never drops a parameter it considers applicable", () => {
    for (const id of MODEL_IDS) {
      const { params, dropped } = dropUnsupported(id, { ...getDefaults(id) });
      for (const path of Object.keys(params)) {
        expect(isApplicable(id, path, params), `${id} kept inapplicable ${path}`).toBe(true);
      }
      for (const d of dropped) {
        expect(Object.keys(params)).not.toContain(d.path);
      }
    }
  });
});
