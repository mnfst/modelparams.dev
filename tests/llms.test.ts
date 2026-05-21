import { describe, it, expect } from "vitest";
import { buildLlmsFullTxt, buildLlmsTxt, usageGuideMarkdown } from "../src/data/llms.js";
import type { Model } from "../src/schema/model.js";

const SITE = "https://modelparameters.dev";

function makeModel(overrides: Partial<Model> = {}): Model {
  return {
    provider: "anthropic",
    authType: "api_key",
    model: "claude-opus-4-7",
    params: [
      {
        path: "max_tokens",
        type: "integer",
        label: "Max tokens",
        description: "Maximum output tokens.",
        default: 4096,
        range: { min: 1 },
        group: "generation_length",
      },
      {
        path: "thinking.display",
        type: "enum",
        label: "Thinking display",
        description: "Whether thinking is summarized.",
        default: "omitted",
        values: ["summarized", "omitted"],
        group: "reasoning",
        applicability: { only: { "thinking.type": ["adaptive"] } },
      },
    ],
    ...overrides,
  } as Model;
}

describe("usageGuideMarkdown", () => {
  it("renders the guide as Markdown with the catalog endpoints", () => {
    const md = usageGuideMarkdown(SITE);
    expect(md.startsWith("# How to use modelparameters.dev")).toBe(true);
    expect(md).toContain(`curl ${SITE}/api/v1/models.json`);
    expect(md).toContain(`curl ${SITE}/api/v1/schema.json`);
    expect(md).toContain(`${SITE}/llms-full.txt`);
    expect(md).toContain("WebMCP");
  });

  it("threads the provided site url through every reference", () => {
    const md = usageGuideMarkdown("http://localhost:3000");
    expect(md).toContain("curl http://localhost:3000/api/v1/models.json");
    expect(md).not.toContain("https://modelparameters.dev");
  });
});

describe("buildLlmsTxt", () => {
  it("follows the llms.txt shape: H1, summary, sections, model links", () => {
    const txt = buildLlmsTxt(SITE, [makeModel(), makeModel({ authType: "subscription" })]);
    expect(txt.startsWith("# modelparameters.dev")).toBe(true);
    expect(txt).toContain("\n> An open, community-maintained catalog");
    expect(txt).toContain("## API");
    expect(txt).toContain("## Models");
    expect(txt).toContain("## Optional");
    expect(txt).toContain(
      `- [anthropic/claude-opus-4-7](${SITE}/api/v1/models/anthropic/claude-opus-4-7.json):`,
    );
    expect(txt).toContain(
      `- [anthropic/claude-opus-4-7-subscription](${SITE}/api/v1/models/anthropic/claude-opus-4-7-subscription.json):`,
    );
    expect(txt).toContain("2 parameters.");
  });

  it("singularizes a one-parameter model", () => {
    const txt = buildLlmsTxt(SITE, [makeModel({ params: [makeModel().params[0]!] })]);
    expect(txt).toContain("1 parameter.");
  });
});

describe("buildLlmsFullTxt", () => {
  it("embeds the usage guide and dumps each parameter with constraints", () => {
    const full = buildLlmsFullTxt(SITE, [makeModel()]);
    expect(full).toContain("# How to use modelparameters.dev");
    expect(full).toContain("# Full catalog");
    expect(full).toContain("## Anthropic");
    expect(full).toContain("### anthropic/claude-opus-4-7");
    expect(full).toContain(
      "- `max_tokens` (integer, Length) — Maximum output tokens. [default: 4096] [range: min 1]",
    );
    expect(full).toContain(
      '- `thinking.display` (enum, Reasoning) — Whether thinking is summarized. [default: "omitted"] [values: "summarized", "omitted"] [only when thinking.type = "adaptive"]',
    );
  });

  it("notes models that have no parameters yet", () => {
    const full = buildLlmsFullTxt(SITE, [makeModel({ params: [] })]);
    expect(full).toContain("_No parameters documented yet._");
  });
});
