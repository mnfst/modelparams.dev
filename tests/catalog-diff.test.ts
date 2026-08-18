import { describe, expect, it } from "vitest";
import type { Model } from "../src/schema/model.js";
import { diffCatalogs, isEmptyDiff, renderCatalogChangelog } from "../src/data/catalog-diff.js";

const model = (overrides: Partial<Model> = {}): Model => ({
  provider: "anthropic",
  authType: "api_key",
  model: "claude-test",
  params: [
    {
      path: "temperature",
      label: "Temperature",
      description: "Sampling temperature",
      group: "sampling",
      type: "number",
      default: 1,
    },
  ],
  ...overrides,
});

describe("diffCatalogs", () => {
  it("reports an added model", () => {
    const diff = diffCatalogs([], [model()]);
    expect(diff.addedModels).toEqual(["anthropic/claude-test"]);
    expect(diff.changedModels).toEqual([]);
  });

  it("reports a removed model without also reporting its params", () => {
    const diff = diffCatalogs([model()], []);
    expect(diff.removedModels).toEqual(["anthropic/claude-test"]);
    expect(diff.changedModels).toEqual([]);
  });

  it("separates added, removed, and updated params on a surviving model", () => {
    const base = model({
      params: [
        ...model().params,
        {
          path: "top_p",
          label: "Top P",
          description: "Nucleus sampling",
          group: "sampling",
          type: "number",
          default: 1,
        },
      ],
    });
    const current = model({
      params: [
        { ...model().params[0]!, default: 0.7 },
        {
          path: "max_tokens",
          label: "Max tokens",
          description: "Max tokens",
          group: "generation_length",
          type: "integer",
          default: 4096,
        },
      ],
    });

    expect(diffCatalogs([base], [current]).changedModels).toEqual([
      {
        id: "anthropic/claude-test",
        added: ["max_tokens"],
        removed: ["top_p"],
        updated: ["temperature"],
      },
    ]);
  });

  it("treats the subscription variant as its own model id", () => {
    const diff = diffCatalogs([model()], [model(), model({ authType: "subscription" })]);
    expect(diff.addedModels).toEqual(["anthropic/claude-test-subscription"]);
  });

  it("is empty when nothing changed", () => {
    expect(isEmptyDiff(diffCatalogs([model()], [model()]))).toBe(true);
  });
});

describe("renderCatalogChangelog", () => {
  it("says so explicitly when the catalog did not change", () => {
    expect(renderCatalogChangelog(diffCatalogs([model()], [model()]))).toBe(
      "- No catalog changes (package-only release).",
    );
  });

  it("renders each kind of change under its own heading", () => {
    const current = model({
      params: [
        {
          path: "max_tokens",
          label: "Max tokens",
          description: "Max tokens",
          group: "generation_length",
          type: "integer",
          default: 4096,
        },
      ],
    });
    const rendered = renderCatalogChangelog(
      diffCatalogs([model(), model({ model: "claude-gone" })], [current, model({ model: "new" })]),
    );

    expect(rendered).toContain("### Models added\n\n- `anthropic/new`");
    expect(rendered).toContain("### Models removed\n\n- `anthropic/claude-gone`");
    expect(rendered).toContain(
      "- `anthropic/claude-test`: added `max_tokens`; removed `temperature`",
    );
  });
});
