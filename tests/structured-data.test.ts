import { describe, it, expect } from "vitest";
import {
  buildGlossaryStructuredData,
  buildHomeStructuredData,
  buildModelStructuredData,
  buildProviderStructuredData,
} from "../src/build/structured-data.js";
import { buildGlossary } from "../src/data/glossary.js";
import type { Model } from "../src/schema/model.js";

const SITE = "https://modelparams.dev";

function model(over: Partial<Model> = {}): Model {
  return {
    provider: "anthropic",
    authType: "api_key",
    model: "claude-opus-4-7",
    params: [
      {
        path: "temperature",
        type: "number",
        label: "Temperature",
        description: "x",
        group: "sampling",
      },
    ],
    ...over,
  } as Model;
}

function listItemCount(json: string): number {
  return (json.match(/"@type":"ListItem"/g) ?? []).length;
}

describe("buildHomeStructuredData", () => {
  it("uses the modelparams.dev brand and lists every model (no 50-item cap)", () => {
    const models = Array.from({ length: 60 }, (_, i) => model({ model: `m-${i}` }));
    const json = buildHomeStructuredData(models, SITE, `${SITE}/assets/og.png`);

    expect(json).toContain('"name":"modelparams.dev"');
    expect(json).toContain('"name":"modelparams.dev catalog"');
    expect(json).toContain(`"image":"${SITE}/assets/og.png"`);
    expect(json).toContain('"numberOfItems":60');
    expect(json).toContain(`${SITE}/models/anthropic/m-0`);
    expect(json).not.toContain("modelparameters.dev");
    expect(listItemCount(json)).toBe(60);
  });
});

describe("buildModelStructuredData", () => {
  it("emits a breadcrumb and a dataset that links the existing JSON endpoint", () => {
    const json = buildModelStructuredData(model(), "desc", SITE);

    expect(json).toContain('"@type":"BreadcrumbList"');
    expect(json).toContain('"@type":"Dataset"');
    expect(json).toContain(`${SITE}/api/v1/models/anthropic/claude-opus-4-7.json`);
    expect(json).toContain(`"item":"${SITE}/models/anthropic/claude-opus-4-7"`);
    expect(json).toContain('"name":"temperature"');
  });
});

describe("buildProviderStructuredData", () => {
  it("lists provider models with their page urls", () => {
    const json = buildProviderStructuredData(
      "anthropic",
      [model(), model({ model: "claude-haiku-4-5" })],
      "desc",
      SITE,
    );

    expect(json).toContain('"@type":"BreadcrumbList"');
    expect(json).toContain('"numberOfItems":2');
    expect(json).toContain(`${SITE}/models/anthropic/claude-haiku-4-5`);
  });
});

describe("buildGlossaryStructuredData", () => {
  it("emits a DefinedTermSet keyed by parameter path", () => {
    const json = buildGlossaryStructuredData(buildGlossary([model()]), SITE);

    expect(json).toContain('"@type":"DefinedTermSet"');
    expect(json).toContain('"termCode":"temperature"');
  });
});
