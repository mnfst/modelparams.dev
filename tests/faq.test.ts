import { describe, it, expect } from "vitest";
import { modelFaq } from "../src/data/faq.js";
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
        description: "Sampling temperature.",
        default: 1,
        range: { min: 0, max: 2 },
        group: "sampling",
      },
      {
        path: "max_tokens",
        type: "integer",
        label: "Max tokens",
        description: "Maximum output tokens.",
        default: 4096,
        range: { min: 1 },
        group: "generation_length",
      },
    ],
    ...over,
  } as Model;
}

describe("modelFaq", () => {
  it("leads with the parameter count and names the model", () => {
    const faqs = modelFaq(model());
    expect(faqs[0]!.question).toBe("How many parameters does Anthropic Claude Opus 4.7 accept?");
    expect(faqs[0]!.answer).toContain("2 API parameters");
    expect(faqs[0]!.answer).toContain("temperature");
  });

  it("answers default questions with the value and range from the data", () => {
    const faqs = modelFaq(model());
    const temp = faqs.find((f) => f.question.includes("default temperature"));
    expect(temp?.answer).toBe(
      "The default temperature for Anthropic Claude Opus 4.7 is 1, within a valid range of 0 to 2.",
    );
    const maxTokens = faqs.find((f) => f.question.includes("default max_tokens"));
    expect(maxTokens?.answer).toContain("with a minimum of 1");
  });

  it("marks the subscription variant in the subject", () => {
    const faqs = modelFaq(model({ authType: "subscription" }));
    expect(faqs[0]!.question).toContain("Anthropic Claude Opus 4.7 (subscription)");
  });

  it("skips parameters without a documented default", () => {
    const faqs = modelFaq(
      model({
        params: [
          {
            path: "top_p",
            type: "number",
            label: "Top P",
            description: "Nucleus.",
            group: "sampling",
          },
        ],
      }),
    );
    expect(faqs).toHaveLength(1);
    expect(faqs[0]!.question).toContain("How many parameters");
  });

  it("returns nothing for a model with no parameters", () => {
    expect(modelFaq(model({ params: [] }))).toEqual([]);
  });
});
