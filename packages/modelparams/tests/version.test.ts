import { describe, expect, it } from "vitest";
import type { Model } from "../../../src/schema/model.js";
import { bumpVersion, canonicalCatalog, decideBump } from "../scripts/lib/version.js";

const baseModel: Model = {
  provider: "anthropic",
  authType: "api_key",
  model: "claude-test",
  params: [
    {
      path: "max_tokens",
      label: "Max tokens",
      description: "Max tokens",
      group: "generation_length",
      type: "integer",
      default: 4096,
    },
    {
      path: "temperature",
      label: "Temperature",
      description: "Sampling temperature",
      group: "sampling",
      type: "number",
      default: 1,
    },
  ],
};

const baseCanon = canonicalCatalog([baseModel]);

describe("decideBump", () => {
  it("returns major when a parameter is removed", () => {
    const current: Model = {
      ...baseModel,
      params: baseModel.params.filter((p) => p.path !== "temperature"),
    };
    expect(
      decideBump({
        baseCanon,
        currentCanon: canonicalCatalog([current]),
        hasRemovals: true,
      }),
    ).toBe("major");
  });

  it("returns patch when a parameter is added", () => {
    const current: Model = {
      ...baseModel,
      params: [
        ...baseModel.params,
        {
          path: "top_p",
          label: "Top P",
          description: "Nucleus sampling cutoff",
          group: "sampling",
          type: "number",
          default: 1,
        },
      ],
    };
    expect(
      decideBump({
        baseCanon,
        currentCanon: canonicalCatalog([current]),
        hasRemovals: false,
      }),
    ).toBe("patch");
  });

  it("returns patch when a default changes", () => {
    const current: Model = {
      ...baseModel,
      params: baseModel.params.map((p) => (p.path === "max_tokens" ? { ...p, default: 8192 } : p)),
    };
    expect(
      decideBump({
        baseCanon,
        currentCanon: canonicalCatalog([current]),
        hasRemovals: false,
      }),
    ).toBe("patch");
  });

  it("returns patch when a new model is added", () => {
    const sibling: Model = { ...baseModel, model: "claude-other" };
    expect(
      decideBump({
        baseCanon,
        currentCanon: canonicalCatalog([baseModel, sibling]),
        hasRemovals: false,
      }),
    ).toBe("patch");
  });

  it("returns null when nothing semantic changed", () => {
    expect(
      decideBump({
        baseCanon,
        currentCanon: canonicalCatalog([baseModel]),
        hasRemovals: false,
      }),
    ).toBeNull();
  });

  it("is stable across param order", () => {
    const reordered: Model = { ...baseModel, params: [...baseModel.params].reverse() };
    expect(canonicalCatalog([reordered])).toBe(baseCanon);
  });
});

describe("bumpVersion", () => {
  it("bumps major resets minor and patch", () => {
    expect(bumpVersion("0.3.4", "major")).toBe("1.0.0");
    expect(bumpVersion("1.2.7", "major")).toBe("2.0.0");
  });

  it("bumps patch increments only the patch segment", () => {
    expect(bumpVersion("0.0.0", "patch")).toBe("0.0.1");
    expect(bumpVersion("1.2.7", "patch")).toBe("1.2.8");
  });

  it("throws on a non-semver string", () => {
    expect(() => bumpVersion("v1.2.3", "patch")).toThrow();
    expect(() => bumpVersion("1.2", "patch")).toThrow();
  });
});
