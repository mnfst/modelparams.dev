// POST /api/v1/validate — check a params object against a model's catalog entry.
//
// Stateless: the catalog is compiled into the bundle at build time from the same
// generated data the npm package ships, so there is no filesystem read, no
// network call, and nothing to keep in sync at runtime.
import {
  dropUnsupported,
  getModel,
  resolveByBaseUrl,
  resolveModelId,
  type DroppedParam,
} from "../../packages/modelparams/src/index.js";

const MAX_BODY_BYTES = 64 * 1024;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2) + "\n", {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // A validation result is a pure function of the request body, but bodies
      // vary per caller — caching it at the edge would serve one caller's
      // verdict to another.
      "Cache-Control": "no-store",
      ...CORS,
    },
  });
}

function fail(error: string, detail: Record<string, unknown>, status: number): Response {
  return json({ error, ...detail }, status);
}

const USAGE = {
  endpoint: "POST /api/v1/validate",
  description:
    "Validate a params object against a model. Reports unknown parameters, out-of-range values, " +
    "and combinations the provider rejects, and returns a corrected payload.",
  request: {
    model:
      "provider/model id (e.g. anthropic/claude-opus-5), or a bare model slug when it is unambiguous",
    baseUrl:
      "optional — the base URL your SDK is configured with; with it, `model` is the exact wire string you send",
    params: "object of provider-native parameter paths to values",
  },
  example: {
    model: "anthropic/claude-3-opus-20240229",
    params: { temperature: 0.5, top_p: 0.9, max_tokens: 1024 },
  },
  docs: "https://modelparams.dev/api",
} as const;

function toIssue(dropped: DroppedParam) {
  return {
    path: dropped.path,
    code: dropped.code,
    message: dropped.reason,
    ...(dropped.conflictsWith ? { conflictsWith: dropped.conflictsWith } : {}),
  };
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    throw new RangeError(`request body exceeds ${MAX_BODY_BYTES} bytes`);
  }
  if (raw.trim() === "") throw new SyntaxError("request body is empty");
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new SyntaxError("request body must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // A GET here is almost always someone exploring the API by hand or an agent
    // probing the URL, so answer with the contract instead of a bare 405.
    if (request.method === "GET") return json(USAGE);

    if (request.method !== "POST") {
      return fail("method_not_allowed", { allowed: ["POST", "GET", "OPTIONS"], usage: USAGE }, 405);
    }

    let body: Record<string, unknown>;
    try {
      body = await readBody(request);
    } catch (err) {
      const status = err instanceof RangeError ? 413 : 400;
      return fail(
        "invalid_request_body",
        { message: (err as Error).message, usage: USAGE },
        status,
      );
    }

    const { model, params, baseUrl } = body;
    if (typeof model !== "string" || model.trim() === "") {
      return fail(
        "invalid_request_body",
        { message: "`model` must be a non-empty string", usage: USAGE },
        400,
      );
    }
    if (baseUrl !== undefined && (typeof baseUrl !== "string" || baseUrl.trim() === "")) {
      return fail(
        "invalid_request_body",
        { message: "`baseUrl` must be a non-empty string when present", usage: USAGE },
        400,
      );
    }

    // With a base URL, `model` is the exact wire string the SDK sends — the
    // two things a caller actually knows.
    let resolvedId: string | null = null;
    if (baseUrl !== undefined) {
      const byUrl = resolveByBaseUrl(baseUrl, model);
      if (!byUrl.ok) {
        return byUrl.reason === "unknown_base_url"
          ? fail(
              "unknown_base_url",
              {
                message: `"${baseUrl}" is not a catalog provider endpoint`,
                knownBaseUrls: byUrl.knownBaseUrls,
              },
              404,
            )
          : fail(
              "unknown_model",
              {
                message: `"${model}" is not served at that endpoint per the catalog`,
                provider: byUrl.provider,
                models: byUrl.models.slice(0, 50),
              },
              404,
            );
      }
      resolvedId = byUrl.id;
    }

    const resolved = resolveModelId(resolvedId ?? model);
    if (!resolved.ok) {
      return resolved.reason === "ambiguous"
        ? fail(
            "ambiguous_model",
            {
              message: `"${model}" is published by more than one provider; qualify it with a provider prefix`,
              matches: resolved.matches,
            },
            400,
          )
        : fail(
            "unknown_model",
            {
              message: `"${model}" is not in the catalog`,
              suggestions: resolved.suggestions,
              catalog: "https://modelparams.dev/api/v1/models.json",
            },
            404,
          );
    }

    if (
      params !== undefined &&
      (typeof params !== "object" || params === null || Array.isArray(params))
    ) {
      return fail(
        "invalid_request_body",
        { message: "`params` must be an object", usage: USAGE },
        400,
      );
    }

    const supplied = (params ?? {}) as Record<string, unknown>;
    const { params: safeParams, dropped } = dropUnsupported(resolved.id, supplied);
    const entry = getModel(resolved.id);

    return json({
      model: resolved.id,
      provider: entry.provider,
      authType: entry.authType,
      // The exact string to put in the API request when the host's wire id
      // differs from the catalog slug (fireworks, groq).
      ...("requestModel" in entry ? { requestModel: entry.requestModel } : {}),
      valid: dropped.length === 0,
      issues: dropped.map(toIssue),
      // Always a payload that would pass validation — callers that just want to
      // make the call work can spread this and move on.
      safeParams,
      docs: `https://modelparams.dev/models/${resolved.id}`,
    });
  },
};
