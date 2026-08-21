import { describe, expect, it } from "vitest";
import {
  applyLifecycle,
  indexDeprecations,
  toLifecycleRecord,
  type LifecycleRecord,
} from "../src/sync/status.js";

const SAMPLE = `# yaml-language-server: $schema=https://modelparams.dev/api/v1/schema.json
provider: anthropic
authType: api_key
model: claude-opus-4-1-20250805
params:
  - path: temperature
    type: number
    label: Temperature
    description: Controls randomness.
    default: 1
    group: sampling
`;

describe("toLifecycleRecord", () => {
  it("maps deprecations fields onto the lifecycle shape", () => {
    expect(
      toLifecycleRecord({
        provider: "anthropic",
        model: "claude-opus-4-1-20250805",
        status: "retired",
        shutdown_on: "2026-08-05",
        replacements: [{ provider: "anthropic", model: "claude-opus-4-8", recommended: true }],
      }),
    ).toEqual({
      provider: "anthropic",
      model: "claude-opus-4-1-20250805",
      status: "retired",
      replacement: "anthropic/claude-opus-4-8",
      shutdownOn: "2026-08-05",
    });
  });

  it("omits replacement and shutdownOn when absent, and drops null dates", () => {
    expect(
      toLifecycleRecord({
        provider: "xai",
        model: "grok-4.5",
        status: "active",
        shutdown_on: null,
      }),
    ).toEqual({ provider: "xai", model: "grok-4.5", status: "active" });
  });

  it("falls back to the first replacement when none is recommended", () => {
    const record = toLifecycleRecord({
      provider: "openai",
      model: "gpt-4",
      status: "deprecated",
      replacements: [{ provider: "openai", model: "gpt-4.1" }],
    });
    expect(record?.replacement).toBe("openai/gpt-4.1");
  });

  it("ignores malformed entries", () => {
    expect(toLifecycleRecord({ provider: "anthropic" })).toBeUndefined();
    expect(toLifecycleRecord({ status: "retired" })).toBeUndefined();
  });
});

describe("indexDeprecations", () => {
  it("keys records by provider/model", () => {
    const index = indexDeprecations([
      { provider: "anthropic", model: "claude-opus-4-1-20250805", status: "retired" },
      { provider: "xai", model: "grok-4.5", status: "active" },
      { junk: true },
    ]);
    expect(index.size).toBe(2);
    expect(index.get("anthropic/claude-opus-4-1-20250805")?.status).toBe("retired");
  });

  it("rejects a non-array payload", () => {
    expect(() => indexDeprecations({})).toThrow();
  });
});

describe("applyLifecycle", () => {
  const retired: LifecycleRecord = {
    provider: "anthropic",
    model: "claude-opus-4-1-20250805",
    status: "retired",
    replacement: "anthropic/claude-opus-4-8",
    shutdownOn: "2026-08-05",
  };

  it("inserts the lifecycle block after the model line", () => {
    const result = applyLifecycle(SAMPLE, retired);
    expect(result).toContain(
      [
        "model: claude-opus-4-1-20250805",
        "status: retired",
        "replacement: anthropic/claude-opus-4-8",
        "shutdownOn: 2026-08-05",
        "params:",
      ].join("\n"),
    );
    expect(result).toContain("# yaml-language-server:");
  });

  it("is idempotent", () => {
    const once = applyLifecycle(SAMPLE, retired);
    expect(applyLifecycle(once, retired)).toBe(once);
  });

  it("replaces a stale block and drops fields the source no longer provides", () => {
    const stale = applyLifecycle(SAMPLE, retired);
    const active: LifecycleRecord = {
      provider: "anthropic",
      model: "claude-opus-4-1-20250805",
      status: "active",
    };
    const result = applyLifecycle(stale, active);
    expect(result).toContain("status: active\nparams:");
    expect(result).not.toContain("replacement:");
    expect(result).not.toContain("shutdownOn:");
  });

  it("leaves text without a model line unchanged", () => {
    const noModel = "provider: anthropic\nparams: []\n";
    expect(applyLifecycle(noModel, retired)).toBe(noModel);
  });
});
