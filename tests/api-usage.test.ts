import { describe, expect, it } from "vitest";
import { classifyEndpoint } from "../src/tracking/api-usage.js";

describe("classifyEndpoint", () => {
  it("recognises the fixed endpoints", () => {
    expect(classifyEndpoint("/api/v1/index.json").endpoint).toBe("index");
    expect(classifyEndpoint("/api/v1/models.json").endpoint).toBe("catalog");
    expect(classifyEndpoint("/api/v1/schema.json").endpoint).toBe("schema");
    expect(classifyEndpoint("/api/v1/validate").endpoint).toBe("validate");
    expect(classifyEndpoint("/api/v1/validate/").endpoint).toBe("validate");
    expect(classifyEndpoint("/llms.txt").endpoint).toBe("llms");
    expect(classifyEndpoint("/llms-full.txt").endpoint).toBe("llms");
  });

  it("recognises the MCP server on both its public and rewritten paths", () => {
    expect(classifyEndpoint("/mcp").endpoint).toBe("mcp");
    expect(classifyEndpoint("/api/mcp").endpoint).toBe("mcp");
  });

  it("extracts provider and model from model_by_id paths", () => {
    expect(classifyEndpoint("/api/v1/models/openai/gpt-4.1.json")).toEqual({
      endpoint: "model_by_id",
      authMode: "api_key",
      provider: "openai",
      model: "gpt-4.1",
    });
  });

  it("splits the -subscription suffix into auth_mode", () => {
    expect(classifyEndpoint("/api/v1/models/openai/gpt-4.1-subscription.json")).toEqual({
      endpoint: "model_by_id",
      authMode: "subscription",
      provider: "openai",
      model: "gpt-4.1",
    });
    expect(classifyEndpoint("/api/v1/params/gpt-5.5-subscription.json")).toEqual({
      endpoint: "params_by_model",
      authMode: "subscription",
      provider: null,
      model: "gpt-5.5",
    });
  });

  it("extracts the model from params_by_model paths", () => {
    expect(classifyEndpoint("/api/v1/params/gpt-5.5.json")).toEqual({
      endpoint: "params_by_model",
      authMode: "api_key",
      provider: null,
      model: "gpt-5.5",
    });
  });

  it("buckets anything else as other", () => {
    expect(classifyEndpoint("/api/v1/nope").endpoint).toBe("other");
    expect(classifyEndpoint("/api/v1/models/openai/too/deep.json").endpoint).toBe("other");
    expect(classifyEndpoint("/").endpoint).toBe("other");
  });
});
