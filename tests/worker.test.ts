import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "../worker/index.js";

/** A stand-in for the static-assets binding: a few files and a clean-URL redirect. */
function assets(): Env {
  const files: Record<string, string> = {
    "/": "<html>home</html>",
    "/api/v1/models.json": "[]",
    "/llms.txt": "# modelparams",
  };
  return {
    ASSETS: {
      async fetch(request: Request) {
        const { pathname } = new URL(request.url);
        if (pathname === "/api.html") {
          return new Response(null, { status: 307, headers: { Location: "/api" } });
        }
        const body = files[pathname];
        return body === undefined ? new Response("missing", { status: 404 }) : new Response(body);
      },
    },
  };
}

const get = (url: string, init?: RequestInit) => worker.fetch(new Request(url, init), assets());

describe("Cloudflare Worker", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(["modelparameters.dev", "www.modelparameters.dev", "www.modelparams.dev"])(
    "redirects %s to modelparams.dev with a 308",
    async (host) => {
      const res = await get(`https://${host}/models/openai?x=1`);
      expect(res.status).toBe(308);
      expect(res.headers.get("Location")).toBe("https://modelparams.dev/models/openai?x=1");
    },
  );

  it("serves the home page from assets", async () => {
    const res = await get("https://modelparams.dev/");
    expect(await res.text()).toBe("<html>home</html>");
  });

  it("turns the asset layer's clean-URL 307 into a 308", async () => {
    const res = await get("https://modelparams.dev/api.html");
    expect(res.status).toBe(308);
    expect(res.headers.get("Location")).toBe("/api");
  });

  it("adds the catalog headers to static API files", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await get("https://modelparams.dev/api/v1/models.json");
    expect(res.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300, s-maxage=3600");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("serves llms.txt as text with CORS", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await get("https://modelparams.dev/llms.txt");
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("answers unknown API paths with JSON", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await get("https://modelparams.dev/api/v1/nope.json");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found", path: "/api/v1/nope.json" });
  });

  it("routes /api/v1/validate and logs the call", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await get("https://modelparams.dev/api/v1/validate", {
      method: "POST",
      body: JSON.stringify({ model: "nope/nope" }),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("unknown_model");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(JSON.parse(log.mock.calls[0]?.[0] as string)).toMatchObject({
      event: "api_request",
      endpoint: "validate",
    });
  });

  it.each(["/mcp", "/api/mcp"])("routes %s to the MCP server", async (path) => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await get(`https://modelparams.dev${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.tools.map((t: { name: string }) => t.name)).toContain(
      "validate_model_params",
    );
  });
});
