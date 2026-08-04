import { describe, it, expect } from "vitest";
import { homeDescription, homeTitle } from "../src/build/render.js";
import {
  modelPageDescription,
  modelPageTitle,
  modelParamProse,
} from "../src/build/render-model.js";
import { providerPageDescription, providerPageTitle } from "../src/build/render-provider.js";
import { parameterPageDescription, parameterPageTitle } from "../src/build/render-parameter.js";
import { uniqueProviders } from "../src/data/catalog.js";
import { loadAllModels } from "../src/data/load.js";
import { buildParameterIndex } from "../src/data/parameters.js";
import { DESCRIPTION_MAX, TITLE_MAX } from "../src/build/meta.js";
import {
  modelJsonPath,
  modelPagePath,
  parameterPagePath,
  parameterSlug,
  providerPagePath,
} from "../src/data/urls.js";
import type { Model } from "../src/schema/model.js";

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

describe("url helpers", () => {
  it("builds page and JSON paths from the model id", () => {
    expect(modelPagePath(model())).toBe("/models/anthropic/claude-opus-4-7");
    expect(modelPagePath(model({ authType: "subscription" }))).toBe(
      "/models/anthropic/claude-opus-4-7-subscription",
    );
    expect(modelJsonPath(model())).toBe("/api/v1/models/anthropic/claude-opus-4-7.json");
    expect(providerPagePath("openai")).toBe("/providers/openai");
  });

  it("slugs parameter paths for their pages", () => {
    expect(parameterSlug("top_p")).toBe("top_p");
    expect(parameterSlug("thinking.type")).toBe("thinking-type");
    expect(parameterPagePath("top_p")).toBe("/parameters/top_p");
  });
});

describe("parameter page meta", () => {
  it("titles and describes a parameter with its path and model count", () => {
    const detail = buildParameterIndex([model()])[0]!;
    expect(parameterPageTitle(detail)).toContain("temperature");
    const desc = parameterPageDescription(detail);
    expect(desc).toContain("temperature");
    expect(desc).toContain("1 model");
  });

  it("agrees the verb with the model count", () => {
    const one = buildParameterIndex([model()])[0]!;
    expect(parameterPageDescription(one)).toContain("1 model that accepts it");
    const many = buildParameterIndex([model(), model({ model: "claude-opus-4-8" })])[0]!;
    expect(parameterPageDescription(many)).toContain("2 models that accept it");
  });

  it("keeps a deeply nested path inside the title budget", () => {
    const nested = buildParameterIndex([
      model({
        params: [
          {
            path: "generationConfig.thinkingConfig.includeThoughts",
            type: "boolean",
            label: "Include thoughts",
            description: "x",
            group: "reasoning",
          },
        ],
      } as Partial<Model>),
    ])[0]!;
    expect(parameterPageTitle(nested).length).toBeLessThanOrEqual(TITLE_MAX);
    // The short form still names the parameter, just without the full path.
    expect(parameterPageTitle(nested)).toContain("includeThoughts");
  });
});

describe("modelParamProse", () => {
  it("groups parameters into labelled clauses keyed by path", () => {
    const groups = modelParamProse(model());
    const sampling = groups.find((g) => g.label === "Sampling");
    expect(sampling?.clauses.some((c) => c.path === "temperature")).toBe(true);
  });
});

describe("model page meta", () => {
  it("titles api-key and subscription variants distinctly", () => {
    expect(modelPageTitle(model())).toBe(
      "Anthropic Claude Opus 4.7 API parameters · modelparams.dev",
    );
    expect(modelPageTitle(model({ authType: "subscription" }))).toContain("(subscription)");
  });

  it("summarizes the parameter set in the description", () => {
    const desc = modelPageDescription(model());
    expect(desc).toContain("Anthropic Claude Opus 4.7");
    expect(desc).toContain("temperature");
  });
});

describe("home page meta", () => {
  it("leads with the brand and carries the live model count in the title", () => {
    expect(homeTitle(198)).toBe("modelparams.dev · LLM API Parameters for 198 Models");
  });

  it("opens the description on the brand, then real parameters and live counts", () => {
    const desc = homeDescription(198, 15, ["temperature", "top_p", "max_tokens"]);
    expect(desc.startsWith("modelparams.dev is the open catalog of LLM API parameters.")).toBe(
      true,
    );
    expect(desc).toContain("Compare temperature, top_p, max_tokens");
    expect(desc).toContain("198 models from 15 providers");
  });

  it("still reads cleanly when no sample parameters are available", () => {
    expect(homeDescription(198, 15, [])).toContain("Compare every knob you can turn");
  });

  it("keeps the brand-first title and description inside the SERP budget", () => {
    expect(homeTitle(1000).length).toBeLessThanOrEqual(TITLE_MAX);
    const wide = homeDescription(1000, 40, ["temperature", "top_p", "max_tokens"]);
    expect(wide.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });
});

describe("provider page meta", () => {
  it("names the provider and counts its models", () => {
    expect(providerPageTitle("anthropic")).toBe("Anthropic API parameters · modelparams.dev");
    expect(providerPageDescription("anthropic", [model(), model()])).toContain(
      "2 Anthropic models",
    );
  });
});

// The word "parameters" alone is what someone types when they want a weight
// count. Every page title has to carry the qualifier that separates the two
// senses, including after `fitTitle` drops candidates to fit the SERP budget.
describe("titles disambiguate parameters from weight counts", () => {
  it("keeps API in the model title even at the shortest fallback", () => {
    const long = model({ provider: "alibaba", model: "qwen3-8-max-thinking-preview-long" });
    expect(modelPageTitle(long)).toContain("API parameters");
    expect(modelPageTitle(model({ authType: "subscription" }))).toContain("API parameters");
  });

  it("keeps API in the home and provider titles", () => {
    expect(homeTitle(1000)).toContain("API Parameters");
    expect(providerPageTitle("openai")).toContain("API parameters");
  });
});

// The templates above are budget-aware, but only the real catalog has the model
// names and nested parameter paths long enough to blow the budget. This walks
// every page the build emits so an overflowing title can't ship unnoticed.
describe("every page in the real catalog fits the SERP budget", async () => {
  const { models } = await loadAllModels();
  const details = buildParameterIndex(models);
  const providers = uniqueProviders(models);

  const pages: { page: string; title: string; description: string }[] = [
    {
      page: "/",
      title: homeTitle(models.length),
      description: homeDescription(models.length, providers.length, ["temperature", "top_p"]),
    },
    ...providers.map((provider) => {
      const owned = models.filter((m) => m.provider === provider);
      return {
        page: `/providers/${provider}`,
        title: providerPageTitle(provider),
        description: providerPageDescription(provider, owned),
      };
    }),
    ...details.map((detail) => ({
      page: `/parameters/${detail.slug}`,
      title: parameterPageTitle(detail),
      description: parameterPageDescription(detail),
    })),
    ...models.map((m) => ({
      page: modelPagePath(m),
      title: modelPageTitle(m),
      description: modelPageDescription(m),
    })),
  ];

  it("has a catalog to check", () => {
    expect(pages.length).toBeGreaterThan(100);
  });

  it("keeps every title within the truncation limit", () => {
    const over = pages.filter((p) => p.title.length > TITLE_MAX);
    expect(over.map((p) => `${p.page} (${p.title.length}): ${p.title}`)).toEqual([]);
  });

  it("keeps every description within the truncation limit", () => {
    const over = pages.filter((p) => p.description.length > DESCRIPTION_MAX);
    expect(over.map((p) => `${p.page} (${p.description.length})`)).toEqual([]);
  });

  it("keeps every title and description unique", () => {
    const titles = new Set(pages.map((p) => p.title));
    const descriptions = new Set(pages.map((p) => p.description));
    expect(titles.size).toBe(pages.length);
    expect(descriptions.size).toBe(pages.length);
  });

  it("never repeats the provider name inside a model title", () => {
    const stutter = models
      .map((m) => modelPageTitle(m))
      .filter((title) => /^(\S+)\s+\1\b/i.test(title));
    expect(stutter).toEqual([]);
  });
});
