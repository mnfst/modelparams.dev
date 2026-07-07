import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeApp } from "../src/server/app.js";
import type { Model } from "../src/schema/model.js";

function makeModel(overrides: Partial<Model> = {}): Model {
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
    ...overrides,
  } as Model;
}

const MODELS: Model[] = [
  makeModel(),
  makeModel({ authType: "subscription" }),
  makeModel({
    provider: "openai",
    model: "gpt-4o",
    params: [
      { path: "top_p", type: "number", label: "Top P", description: "Nucleus.", group: "sampling" },
    ],
  }),
];

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = makeApp(async () => MODELS);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

const get = (path: string): Promise<Response> => fetch(`${baseUrl}${path}`);

describe("GET /healthz", () => {
  it("reports ok", async () => {
    const res = await get("/healthz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("hides the x-powered-by header", async () => {
    const res = await get("/healthz");
    expect(res.headers.get("x-powered-by")).toBeNull();
  });
});

describe("GET /api/v1/models.json", () => {
  it("returns the catalog with a count and a $schema", async () => {
    const res = await get("/api/v1/models.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body.count).toBe(MODELS.length);
    expect(body.models).toHaveLength(MODELS.length);
    expect(body.$schema).toBe("https://modelparams.dev/api/v1/schema.json");
  });
});

describe("GET /api/v1/schema.json", () => {
  it("returns the JSON Schema for a model", async () => {
    const res = await get("/api/v1/schema.json");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.$id).toBe("https://modelparams.dev/api/v1/schema.json");
    expect(body.title).toBe("modelparams.dev Model");
    expect(body.definitions?.Model).toBeTruthy();
  });
});

describe("GET /api/v1/params/:model.json", () => {
  it("returns params for an api-key model slug without provider metadata", async () => {
    const res = await get("/api/v1/params/claude-opus-4-7.json");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      model: "claude-opus-4-7",
      params: MODELS[0]!.params,
    });
  });

  it("returns params for the -subscription model variant", async () => {
    const res = await get("/api/v1/params/claude-opus-4-7-subscription.json");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.model).toBe("claude-opus-4-7-subscription");
    expect(body.params).toEqual(MODELS[1]!.params);
  });

  it("404s with a model-scoped JSON error for an unknown slug", async () => {
    const res = await get("/api/v1/params/does-not-exist.json");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found", model: "does-not-exist" });
  });
});

describe("GET /api/v1/models/:provider/:slug.json", () => {
  it("returns the full model for a known id", async () => {
    const res = await get("/api/v1/models/anthropic/claude-opus-4-7.json");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider).toBe("anthropic");
    expect(body.model).toBe("claude-opus-4-7");
    expect(body.authType).toBe("api_key");
    expect(body.$schema).toBe("https://modelparams.dev/api/v1/schema.json");
  });

  it("resolves the -subscription variant to the subscription model", async () => {
    const res = await get("/api/v1/models/anthropic/claude-opus-4-7-subscription.json");
    expect(res.status).toBe(200);
    expect((await res.json()).authType).toBe("subscription");
  });

  it("404s with a JSON error for an unknown id", async () => {
    const res = await get("/api/v1/models/anthropic/does-not-exist.json");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found", id: "anthropic/does-not-exist" });
  });
});

describe("GET / (home)", () => {
  it("renders HTML with no-store caching", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.text();
    expect(body).toContain("<!doctype html>");
    expect(body).toContain("modelparams.dev");
  });

  it("carries a concrete title and a crawlable browse-by-parameter section", async () => {
    const body = await get("/").then((r) => r.text());
    expect(body).toContain("Compare model parameters across 3 models");
    expect(body).toContain("Browse by parameter");
    expect(body).toContain('href="/parameters/temperature"');
    expect(body).toContain('href="/parameters/max_tokens"');
  });
});

describe("GET /glossary", () => {
  it("renders the glossary page", async () => {
    const res = await get("/glossary");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("<!doctype html>");
  });
});

describe("GET /parameters/:slug", () => {
  it("renders a parameter page for a known parameter", async () => {
    const res = await get("/parameters/temperature");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("<!doctype html>");
    expect(body).toContain("temperature");
  });

  it("404s for an unknown parameter", async () => {
    const res = await get("/parameters/not-a-parameter");
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Unknown parameter");
  });
});

describe("GET /providers/:provider", () => {
  it("renders a hub for a known provider", async () => {
    const res = await get("/providers/anthropic");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("Anthropic");
  });

  it("404s for an unknown provider", async () => {
    const res = await get("/providers/not-a-provider");
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Unknown provider");
  });
});

describe("GET /models/:provider/:slug", () => {
  it("renders a model page for a known model", async () => {
    const res = await get("/models/openai/gpt-4o");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("<!doctype html>");
  });

  it("404s for an unknown model", async () => {
    const res = await get("/models/anthropic/does-not-exist");
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Unknown model");
  });

  it("renders a data-driven FAQ with a FAQPage node", async () => {
    const body = await get("/models/anthropic/claude-opus-4-7").then((r) => r.text());
    expect(body).toContain("Frequently asked questions");
    expect(body).toContain("What is the default temperature for Anthropic Claude Opus 4.7?");
    expect(body).toContain('"@type":"FAQPage"');
  });
});

describe("llms.txt feeds", () => {
  it("serves llms.txt as plain text", async () => {
    const res = await get("/llms.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toMatch(/^# modelparams\.dev/);
  });

  it("serves the full catalog dump", async () => {
    const res = await get("/llms-full.txt");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("# Full catalog");
  });
});
