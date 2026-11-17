/**
 * Classifies API paths for the usage log line the Cloudflare Worker writes to
 * Workers Logs (see worker/index.ts): which endpoint, auth mode, provider and
 * model a request was for.
 */

export interface EndpointInfo {
  endpoint:
    | "index"
    | "catalog"
    | "schema"
    | "model_by_id"
    | "params_by_model"
    | "validate"
    | "llms"
    | "mcp"
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
  // /mcp is the public path; direct hits on /api/mcp are the same endpoint.
  if (path === "/mcp" || path === "/api/mcp") return { ...none, endpoint: "mcp" };
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
