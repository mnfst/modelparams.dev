import { describe, it, expect } from "vitest";
import { disambiguationFaq } from "../src/data/disambiguation.js";
import { buildDisambiguationStructuredData } from "../src/build/structured-data.js";

const SITE = "https://modelparams.dev";

describe("disambiguationFaq", () => {
  it("carries the live model count in the lead answer", () => {
    expect(disambiguationFaq(198)[0]!.answer).toContain("198 models");
  });

  // This is the one page that should match a weight-count query. If these
  // phrasings ever move off it, the model pages start competing for that
  // intent again, which is the problem the page exists to solve.
  it("owns the weight-count phrasings", () => {
    const questions = disambiguationFaq(198).map((faq) => faq.question);
    expect(questions.some((q) => /how many parameters/i.test(q))).toBe(true);
    expect(questions.some((q) => /hyperparameters/i.test(q))).toBe(true);
  });

  it("answers the count question with a refusal, not a number", () => {
    const [first] = disambiguationFaq(198);
    expect(first!.answer).toMatch(/^No\./);
    expect(first!.answer).toContain("API parameters");
  });
});

describe("buildDisambiguationStructuredData", () => {
  const graph = () =>
    JSON.parse(buildDisambiguationStructuredData(disambiguationFaq(198), "Description.", SITE))[
      "@graph"
    ] as Record<string, unknown>[];

  it("emits a WebPage that points about at the API-parameter concept", () => {
    const page = graph().find((node) => node["@type"] === "WebPage");
    expect(page?.about).toEqual({ "@id": `${SITE}/#api-parameter` });
    expect(page?.url).toBe(`${SITE}/model-parameters-vs-api-parameters`);
  });

  it("defines the concept node the about reference resolves to", () => {
    const term = graph().find((node) => node["@id"] === `${SITE}/#api-parameter`);
    expect(term?.["@type"]).toBe("DefinedTerm");
    expect(String(term?.description)).toContain("trained weight");
  });

  it("puts every weight-count question in the FAQPage", () => {
    const faq = graph().find((node) => node["@type"] === "FAQPage");
    expect((faq?.mainEntity as unknown[]).length).toBe(disambiguationFaq(198).length);
  });
});
