import { describe, expect, it } from "vitest";
import handler from "../api/v1/validate.js";

interface ValidateBody {
  model: string;
  provider: string;
  authType: string;
  requestModel?: string;
  valid: boolean;
  issues: { path: string; code: string; message: string; conflictsWith?: string[] }[];
  safeParams: Record<string, unknown>;
  error?: string;
  suggestions?: string[];
  matches?: string[];
  knownBaseUrls?: string[];
}

async function post(body: unknown): Promise<{ status: number; body: ValidateBody }> {
  const response = await handler.fetch(
    new Request("https://modelparams.dev/api/v1/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
  return { status: response.status, body: (await response.json()) as ValidateBody };
}

describe("POST /api/v1/validate", () => {
  it("returns the wire id for hosts whose native ids are pathed", async () => {
    const { status, body } = await post({ model: "fireworks/kimi-k3", params: {} });
    expect(status).toBe(200);
    expect(body.requestModel).toBe("accounts/fireworks/models/kimi-k3");
  });

  it("omits requestModel when the catalog slug is the wire id", async () => {
    const { body } = await post({ model: "anthropic/claude-3-opus-20240229", params: {} });
    expect(body.requestModel).toBeUndefined();
  });

  it("accepts a valid params object", async () => {
    const { status, body } = await post({
      model: "anthropic/claude-3-opus-20240229",
      params: { max_tokens: 1024, temperature: 1 },
    });
    expect(status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.issues).toEqual([]);
    expect(body.safeParams).toEqual({ max_tokens: 1024, temperature: 1 });
  });

  it("reports a conditional conflict and returns a corrected payload", async () => {
    const { status, body } = await post({
      model: "anthropic/claude-3-opus-20240229",
      params: { temperature: 0.5, top_p: 0.9, max_tokens: 1024 },
    });
    expect(status).toBe(200);
    expect(body.valid).toBe(false);
    expect(body.issues).toHaveLength(1);
    expect(body.issues[0]!.path).toBe("top_p");
    expect(body.issues[0]!.code).toBe("not_applicable");
    expect(body.issues[0]!.conflictsWith).toContain("temperature");
    expect(body.safeParams).toEqual({ temperature: 0.5, max_tokens: 1024 });
  });

  it("reports an unknown parameter", async () => {
    const { body } = await post({
      model: "openai/gpt-5.5",
      params: { temperature: 0.7 },
    });
    expect(body.valid).toBe(false);
    expect(body.issues[0]!).toMatchObject({ path: "temperature", code: "unknown_parameter" });
    expect(body.safeParams).toEqual({});
  });

  it("reports an out-of-range value", async () => {
    const { body } = await post({
      model: "anthropic/claude-3-opus-20240229",
      params: { temperature: 42 },
    });
    expect(body.valid).toBe(false);
    expect(body.issues[0]!).toMatchObject({ path: "temperature", code: "invalid_value" });
  });

  it("resolves from the SDK's base URL and wire model string", async () => {
    const { status, body } = await post({
      baseUrl: "https://api.fireworks.ai/inference/v1",
      model: "accounts/fireworks/models/kimi-k3",
      params: {},
    });
    expect(status).toBe(200);
    expect(body.model).toBe("fireworks/kimi-k3");
  });

  it("404s an unknown base URL with the known endpoints", async () => {
    const { status, body } = await post({
      baseUrl: "https://api.nope.dev/v1",
      model: "x",
      params: {},
    });
    expect(status).toBe(404);
    expect(body.error).toBe("unknown_base_url");
  });

  it("requires a provider prefix and lists the qualified ids", async () => {
    const { status, body } = await post({ model: "kimi-k3", params: {} });
    expect(status).toBe(400);
    expect(body.error).toBe("provider_required");
    expect(body.matches).toContain("fireworks/kimi-k3");
    expect(body.matches).toContain("moonshot/kimi-k3");
  });

  it("treats a missing params object as an empty request", async () => {
    const { status, body } = await post({ model: "openai/gpt-5.5" });
    expect(status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.safeParams).toEqual({});
  });

  it("404s an unknown model with usable suggestions", async () => {
    const { status, body } = await post({ model: "openai/gpt-5.5-turbo-ultra", params: {} });
    expect(status).toBe(404);
    expect(body.error).toBe("unknown_model");
    // Near-misses, not an empty array: the caller needs something to retry with.
    expect(body.suggestions?.length).toBeGreaterThan(0);
    expect(body.suggestions).toContain("openai/gpt-5.5");
  });

  it("400s a malformed body", async () => {
    const { status, body } = await post("{not json");
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_request_body");
  });

  it("400s a missing model", async () => {
    const { status, body } = await post({ params: { temperature: 1 } });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_request_body");
  });

  it("400s a non-object params", async () => {
    const { status } = await post({ model: "openai/gpt-5.5", params: [1, 2] });
    expect(status).toBe(400);
  });

  it("never caches a verdict at the edge", async () => {
    const response = await handler.fetch(
      new Request("https://modelparams.dev/api/v1/validate", {
        method: "POST",
        body: JSON.stringify({ model: "openai/gpt-5.5", params: {} }),
      }),
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("other methods on /api/v1/validate", () => {
  it("answers GET with the endpoint contract", async () => {
    const response = await handler.fetch(
      new Request("https://modelparams.dev/api/v1/validate", { method: "GET" }),
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as { endpoint: string }).endpoint).toBe(
      "POST /api/v1/validate",
    );
  });

  it("answers a CORS preflight", async () => {
    const response = await handler.fetch(
      new Request("https://modelparams.dev/api/v1/validate", { method: "OPTIONS" }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it("405s anything else", async () => {
    const response = await handler.fetch(
      new Request("https://modelparams.dev/api/v1/validate", { method: "DELETE" }),
    );
    expect(response.status).toBe(405);
  });
});
