import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyClient,
  classifyEndpoint,
  eventProperties,
  ingestUrl,
  trackApiUsage,
} from "../src/tracking/api-usage.js";

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

describe("classifyClient", () => {
  it.each([
    ["curl/8.6.0", "curl"],
    ["Wget/1.21", "wget"],
    ["python-requests/2.32.0", "python"],
    ["python-httpx/0.27.0", "python"],
    ["node-fetch/3.3.2", "node"],
    ["undici", "node"],
    ["axios/1.7.2", "node"],
    ["Go-http-client/2.0", "go"],
    ["Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)", "bot"],
    ["Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36", "browser"],
    ["SomethingElse/1.0", "other"],
  ])("classifies %s as %s", (userAgent, expected) => {
    expect(classifyClient(userAgent)).toBe(expected);
  });

  it("treats a missing user agent as unknown", () => {
    expect(classifyClient(null)).toBe("unknown");
    expect(classifyClient("")).toBe("unknown");
  });
});

describe("eventProperties", () => {
  it("describes a model params request", () => {
    const request = new Request("https://modelparams.dev/api/v1/params/gpt-5.5.json", {
      headers: { "user-agent": "python-requests/2.32.0" },
    });
    expect(eventProperties(request)).toEqual({
      path: "/api/v1/params/gpt-5.5.json",
      method: "GET",
      endpoint: "params_by_model",
      client: "python",
      auth_mode: "api_key",
      model: "gpt-5.5",
    });
  });

  it("omits absent values instead of sending null", () => {
    const request = new Request("https://modelparams.dev/api/v1/models.json");
    expect(eventProperties(request)).toEqual({
      path: "/api/v1/models.json",
      method: "GET",
      endpoint: "catalog",
      client: "unknown",
    });
  });
});

describe("ingestUrl", () => {
  it("builds the endpoint from VERCEL_URL and is off without it", () => {
    expect(ingestUrl({ VERCEL_URL: "modelparams-abc123.vercel.app" })).toBe(
      "https://modelparams-abc123.vercel.app/_vercel/insights/event",
    );
    expect(ingestUrl({})).toBe(null);
  });

  it("uses a full VERCEL_WEB_ANALYTICS_ENDPOINT override verbatim", () => {
    expect(
      ingestUrl({
        VERCEL_WEB_ANALYTICS_ENDPOINT: "https://example.com/ingest",
        VERCEL_URL: "ignored.vercel.app",
      }),
    ).toBe("https://example.com/ingest");
  });
});

describe("trackApiUsage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const env = { VERCEL_URL: "modelparams-abc123.vercel.app" };
  const request = (method = "GET") =>
    new Request("https://modelparams.dev/api/v1/models.json", {
      method,
      headers: {
        "user-agent": "curl/8.6.0",
        "x-forwarded-for": "203.0.113.7",
      },
    });

  it("is a no-op off Vercel and for CORS preflights", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(trackApiUsage(request(), {})).toBe(null);
    expect(trackApiUsage(request("OPTIONS"), env)).toBe(null);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the @vercel/analytics wire format to the ingest route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await trackApiUsage(request(), env);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(url).toBe("https://modelparams-abc123.vercel.app/_vercel/insights/event");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "content-type": "application/json",
      "x-va-server": "1",
      "user-agent": "curl/8.6.0",
      "x-vercel-ip": "203.0.113.7",
    });
    expect(init.headers).not.toHaveProperty("cookie");

    const body = JSON.parse(init.body) as {
      en: string;
      o: string;
      sdkn: string;
      ed: Record<string, string>;
    };
    expect(body.en).toBe("api_request");
    expect(body.o).toBe("https://modelparams.dev/api/v1/models.json");
    expect(body.sdkn).toBe("@vercel/analytics/server");
    expect(body.ed).toMatchObject({ endpoint: "catalog", client: "curl" });
  });

  it("sends the protection bypass secret when configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await trackApiUsage(request(), { ...env, VERCEL_AUTOMATION_BYPASS_SECRET: "shh" });

    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(init.headers["x-vercel-protection-bypass"]).toBe("shh");
  });

  it("swallows network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(trackApiUsage(request(), env)).resolves.toBe(undefined);
  });
});
