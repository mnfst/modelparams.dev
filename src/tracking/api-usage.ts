/**
 * Server-side usage tracking for the JSON API, reported to Vercel Web
 * Analytics so API traffic shows up in the same dashboard as page views.
 *
 * The API is static files on Vercel's CDN, so the Web Analytics <script> in
 * layout.ejs never sees those requests: curl and SDK clients don't execute
 * JavaScript. Instead, the root middleware.ts observes every /api/* request
 * at the edge and posts an "api_request" custom event to this deployment's
 * ingest route (/_vercel/insights/event).
 *
 * The payload replicates what @vercel/analytics@2.0.1's server track() sends
 * (see its dist/server/index.js). We inline it rather than depend on the
 * package because its optional framework peer deps (@sveltejs/kit → vite 8)
 * conflict with this repo's vite 5 toolchain and would break plain
 * `npm install` for contributors.
 *
 * No configuration: Vercel injects VERCEL_URL, and without it (local dev,
 * tests, forks deployed elsewhere) tracking is a no-op. Viewing custom events
 * in the Analytics tab requires a Pro plan.
 *
 * Runs in the Edge runtime: only Web APIs here (fetch, URL), no Node
 * built-ins.
 */

const SDK_NAME = "@vercel/analytics/server";
const SDK_VERSION = "2.0.1";

export type TrackingEnv = Record<string, string | undefined>;

export interface EndpointInfo {
  endpoint:
    | "index"
    | "catalog"
    | "schema"
    | "model_by_id"
    | "params_by_model"
    | "validate"
    | "llms"
    | "other";
  authMode: "api_key" | "subscription" | null;
  provider: string | null;
  model: string | null;
}

/** Maps a pathname onto the route templates emitted by src/build/build.ts. */
export function classifyEndpoint(pathname: string): EndpointInfo {
  const none: EndpointInfo = { endpoint: "other", authMode: null, provider: null, model: null };
  const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;

  if (path === "/llms.txt" || path === "/llms-full.txt") return { ...none, endpoint: "llms" };
  if (path === "/api/v1/index.json") return { ...none, endpoint: "index" };
  if (path === "/api/v1/models.json") return { ...none, endpoint: "catalog" };
  if (path === "/api/v1/schema.json") return { ...none, endpoint: "schema" };
  if (path === "/api/v1/validate") return { ...none, endpoint: "validate" };

  const byId = path.match(/^\/api\/v1\/models\/([^/]+)\/([^/]+)\.json$/);
  if (byId && byId[1] && byId[2]) {
    const { model, authMode } = splitAuthMode(byId[2]);
    return { endpoint: "model_by_id", authMode, provider: byId[1], model };
  }

  const byParams = path.match(/^\/api\/v1\/params\/([^/]+)\.json$/);
  if (byParams && byParams[1]) {
    const { model, authMode } = splitAuthMode(byParams[1]);
    return { endpoint: "params_by_model", authMode, provider: null, model };
  }

  return none;
}

/** The build emits "<model>-subscription.json" next to the api-key variant. */
function splitAuthMode(slug: string): { model: string; authMode: "api_key" | "subscription" } {
  return slug.endsWith("-subscription")
    ? { model: slug.slice(0, -"-subscription".length), authMode: "subscription" }
    : { model: slug, authMode: "api_key" };
}

/** Coarse consumer bucket, so the events panel can split SDKs from browsers. */
export function classifyClient(userAgent: string | null): string {
  if (!userAgent) return "unknown";
  if (/curl\//i.test(userAgent)) return "curl";
  if (/wget/i.test(userAgent)) return "wget";
  if (/python|httpx|aiohttp/i.test(userAgent)) return "python";
  if (/node|undici|axios|\bgot\b/i.test(userAgent)) return "node";
  if (/go-http-client|golang/i.test(userAgent)) return "go";
  if (/bot|crawler|spider|scrape/i.test(userAgent)) return "bot";
  if (/mozilla|chrome|safari|firefox/i.test(userAgent)) return "browser";
  return "other";
}

/**
 * Custom-event properties. Only present values are sent: Vercel accepts null
 * but renders it as noise in the Events panel, and every name/key/value is
 * capped at 255 characters.
 */
export function eventProperties(request: Request): Record<string, string> {
  const url = new URL(request.url);
  const info = classifyEndpoint(url.pathname);
  const properties: Record<string, string> = {
    path: url.pathname.slice(0, 255),
    method: request.method,
    endpoint: info.endpoint,
    client: classifyClient(request.headers.get("user-agent")),
  };
  if (info.authMode) properties.auth_mode = info.authMode;
  if (info.provider) properties.provider = info.provider;
  if (info.model) properties.model = info.model;
  return properties;
}

/** Ingest endpoint on this deployment, or null when not running on Vercel. */
export function ingestUrl(env: TrackingEnv): string | null {
  const endpoint = env.VERCEL_WEB_ANALYTICS_ENDPOINT || env.VERCEL_URL;
  if (!endpoint) return null;
  return endpoint.startsWith("http")
    ? endpoint
    : new URL("/_vercel/insights/event", `https://${endpoint}`).toString();
}

/**
 * Fire-and-forget capture. Returns the in-flight promise for waitUntil(), or
 * null when tracking is off (not on Vercel) or the request is a CORS
 * preflight. Never throws and never rejects: an analytics outage must not
 * affect the API.
 */
export function trackApiUsage(
  request: Request,
  env: TrackingEnv = process.env,
): Promise<void> | null {
  const url = ingestUrl(env);
  if (!url) return null;
  if (request.method === "OPTIONS") return null;

  // Attribution headers: the ingest route derives visitor, country, and
  // browser from these, exactly as it does for @vercel/analytics/server.
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-va-server": "1",
  };
  const userAgent = request.headers.get("user-agent");
  if (userAgent) headers["user-agent"] = userAgent;
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) headers["x-vercel-ip"] = forwardedFor;
  const cookie = request.headers.get("cookie");
  if (cookie) headers.cookie = cookie;
  // Lets events through on password/SSO-protected preview deployments.
  if (env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers["x-vercel-protection-bypass"] = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }

  const body = JSON.stringify({
    o: request.url,
    ts: Date.now(),
    sdkn: SDK_NAME,
    sdkv: SDK_VERSION,
    r: "",
    en: "api_request",
    ed: eventProperties(request),
  });

  return fetch(url, { method: "POST", headers, body }).then(
    () => undefined,
    () => undefined,
  );
}
