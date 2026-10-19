// Cloudflare Worker for modelparams.dev. Serves the static build in dist/ and
// the two dynamic endpoints, and carries what vercel.json and middleware.ts
// did on Vercel:
//
// - modelparameters.dev and the www hosts redirect (308) to modelparams.dev
// - /mcp and /api/mcp → api/mcp.ts; /api/v1/validate → api/v1/validate.ts
// - the response headers vercel.json set on /api/*, /api/v1/* and llms*.txt
// - clean URLs: the asset layer's 307s become 308s, as on Vercel
// - API usage is logged (Workers Logs) instead of sent to Vercel Analytics
import mcp from "../api/mcp.js";
import validate from "../api/v1/validate.js";
import { classifyEndpoint } from "../src/tracking/api-usage.js";

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const CANONICAL_HOST = "modelparams.dev";
const REDIRECT_HOSTS = new Set([
  "www.modelparams.dev",
  "modelparameters.dev",
  "www.modelparameters.dev",
]);
const CATALOG_CACHE = "public, max-age=300, s-maxage=3600";

type Handler = (request: Request) => Promise<Response>;
const ROUTES: Record<string, Handler> = {
  "/mcp": mcp.fetch,
  "/api/mcp": mcp.fetch,
  "/api/v1/validate": validate.fetch,
};

/** Paths the Vercel middleware counted: the JSON API, MCP and llms*.txt. */
function isTracked(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname === "/mcp" ||
    pathname === "/llms.txt" ||
    pathname === "/llms-full.txt"
  );
}

/** Stand-in for Vercel Analytics custom events: one structured log line. */
function logApiUsage(request: Request, url: URL): void {
  if (!isTracked(url.pathname)) return;
  console.log(
    JSON.stringify({
      event: "api_request",
      method: request.method,
      ...classifyEndpoint(url.pathname),
    }),
  );
}

/** Headers vercel.json added to static files under /api and to llms*.txt. */
function staticHeaders(pathname: string): Record<string, string> {
  if (pathname === "/llms.txt" || pathname === "/llms-full.txt") {
    return {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": CATALOG_CACHE,
    };
  }
  if (pathname.startsWith("/api/v1/")) {
    return {
      ...(pathname.endsWith(".json") ? { "Content-Type": "application/json; charset=utf-8" } : {}),
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": CATALOG_CACHE,
      "X-Robots-Tag": "noindex",
    };
  }
  return {};
}

function withHeaders(response: Response, headers: Record<string, string>): Response {
  const entries = Object.entries(headers);
  if (entries.length === 0) return response;
  const copy = new Response(response.body, response);
  for (const [key, value] of entries) copy.headers.set(key, value);
  return copy;
}

async function serveAsset(request: Request, env: Env, url: URL): Promise<Response> {
  const response = await env.ASSETS.fetch(request);
  // The asset layer redirects /page.html and /page/ to /page with a 307;
  // Vercel's cleanUrls and trailingSlash answer 308, so keep it permanent.
  if (response.status === 307) {
    const location = response.headers.get("Location");
    if (location) return new Response(null, { status: 308, headers: { Location: location } });
  }
  if (response.status === 404 && url.pathname.startsWith("/api/")) {
    // API callers get JSON, not the HTML 404 page.
    return new Response(JSON.stringify({ error: "not_found", path: url.pathname }) + "\n", {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8", "X-Robots-Tag": "noindex" },
    });
  }
  if (response.status >= 400) return response;
  return withHeaders(response, staticHeaders(url.pathname));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (REDIRECT_HOSTS.has(url.hostname)) {
      url.hostname = CANONICAL_HOST;
      url.protocol = "https:";
      url.port = "";
      return Response.redirect(url.toString(), 308);
    }

    logApiUsage(request, url);

    const route = ROUTES[url.pathname];
    if (route) {
      const response = await route(request);
      // The endpoints set their own Cache-Control and CORS; add what
      // vercel.json added on top.
      return url.pathname.startsWith("/api/v1/")
        ? withHeaders(response, { "X-Robots-Tag": "noindex" })
        : response;
    }

    return serveAsset(request, env, url);
  },
};
