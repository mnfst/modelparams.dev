import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CATALOG } from "modelparams";
import { z } from "zod";
import {
  getModelParams,
  listCatalogModels,
  listProviderModels,
  validateModelParams,
  type ToolPayload,
} from "./tools.js";

/** Every tool here is a pure read over data compiled into the package. */
const READ_ONLY = { readOnlyHint: true, idempotentHint: true, openWorldHint: false } as const;

function reply(payload: ToolPayload) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

/**
 * Build the server. Kept separate from any transport so the stdio entry point,
 * the site's HTTP endpoint, and the tests can each drive the same tools.
 *
 * `version` is passed in rather than read from package.json: the HTTP endpoint
 * is bundled by Vercel, where a relative read of the package manifest does not
 * survive bundling, and the two transports report different versions anyway.
 */
export function createServer(version = "0.0.0"): McpServer {
  const server = new McpServer(
    { name: "modelparams", version },
    {
      instructions:
        "Answers what parameters an LLM accepts, using the modelparams.dev catalog of " +
        `${CATALOG.length} models. ` +
        "Call validate_model_params before issuing any LLM request that sets " +
        "non-default parameters, and when diagnosing a 400 from a provider — it catches " +
        "unsupported parameters and invalid combinations that a provider would reject or " +
        "silently ignore.",
    },
  );

  server.registerTool(
    "validate_model_params",
    {
      title: "Validate model parameters",
      description:
        "Check a set of LLM request parameters against what a model actually accepts, before " +
        "calling the provider. Catches unknown parameters, out-of-range values, and " +
        "combinations the provider rejects — such as top_p alongside a non-default " +
        "temperature on Anthropic models, or sampling knobs on reasoning models. Returns a " +
        "corrected `safeParams` payload that is guaranteed to validate. Use this whenever " +
        "writing or debugging code that calls an LLM API with non-default parameters.",
      inputSchema: {
        model: z
          .string()
          .describe(
            'Catalog id ("anthropic/claude-opus-4-7") or bare model slug when unambiguous — or, with baseUrl, the exact wire string your SDK sends.',
          ),
        baseUrl: z
          .string()
          .optional()
          .describe(
            'The base URL your SDK is configured with, e.g. "https://api.fireworks.ai/inference/v1".',
          ),
        params: z
          .record(z.unknown())
          .optional()
          .describe(
            'Provider-native parameter paths to values, e.g. {"temperature": 0.7, "thinking.type": "enabled"}.',
          ),
      },
      annotations: READ_ONLY,
    },
    async (args) => reply(validateModelParams(args)),
  );

  server.registerTool(
    "get_model_params",
    {
      title: "Get model parameters",
      description:
        "List every parameter a model accepts, with its type, allowed range or enum values, " +
        "default, and any conditional rules governing when it applies. Also returns lifecycle " +
        "status and migration guidance when tracked. Use before writing code that calls a " +
        "model, or when building a model settings UI.",
      inputSchema: {
        model: z
          .string()
          .describe(
            'Catalog id ("openai/gpt-5.5") or bare model slug when unambiguous — or, with baseUrl, the exact wire string your SDK sends.',
          ),
        baseUrl: z.string().optional().describe("The base URL your SDK is configured with."),
      },
      annotations: READ_ONLY,
    },
    async (args) => reply(getModelParams(args)),
  );

  server.registerTool(
    "list_models",
    {
      title: "List catalog models",
      description:
        "List model ids in the modelparams.dev catalog, optionally filtered by provider or a " +
        "substring. Use to discover the exact id the other tools expect.",
      inputSchema: {
        provider: z
          .string()
          .optional()
          .describe('Restrict to one provider slug, e.g. "anthropic", "openai", "google".'),
        query: z.string().optional().describe("Case-insensitive substring match on the model id."),
        limit: z.number().int().positive().max(1000).optional().describe("Default 100."),
      },
      annotations: READ_ONLY,
    },
    async (args) => reply(listCatalogModels(args)),
  );

  server.registerTool(
    "list_provider_models",
    {
      title: "List a provider's models and their parameters",
      description:
        "Everything one provider serves: its models, the wire id each one needs, their " +
        "lifecycle status, and the parameter surfaces they expose — types, ranges, enum values, " +
        "defaults, and conditional rules — in a single call. Models that share a parameter " +
        "surface share a profile, so a provider with dozens of models stays small enough to " +
        "read. Use this to pick a model and configure it in one step, especially on Bedrock and " +
        "Vertex where the parameter paths differ from the underlying model's native API.",
      inputSchema: {
        provider: z
          .string()
          .describe(
            'Provider slug, e.g. "bedrock", "vertex", "anthropic". Call list_models with no arguments to see them all.',
          ),
        query: z.string().optional().describe("Case-insensitive substring match on the model id."),
        limit: z.number().int().positive().max(1000).optional().describe("Default 200."),
      },
      annotations: READ_ONLY,
    },
    async (args) => reply(listProviderModels(args)),
  );

  return server;
}
