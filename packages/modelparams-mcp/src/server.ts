import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CATALOG } from "modelparams";
import { z } from "zod";
import {
  findModelsSupporting,
  getModelParams,
  listCatalogModels,
  validateModelParams,
  type ToolPayload,
} from "./tools.js";

// The release workflow rewrites package.json's version; read it there so the
// MCP handshake always reports the shipped version.
const PKG_VERSION: string = (
  createRequire(import.meta.url)("../package.json") as { version: string }
).version;

/** Every tool here is a pure read over data compiled into the package. */
const READ_ONLY = { readOnlyHint: true, idempotentHint: true, openWorldHint: false } as const;

function reply(payload: ToolPayload) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

/**
 * Build the server. Kept separate from the stdio entry point so tests can drive
 * it over an in-memory transport.
 */
export function createServer(): McpServer {
  const server = new McpServer(
    { name: "modelparams", version: PKG_VERSION },
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
          .describe('Catalog id ("anthropic/claude-opus-4-7") or bare model slug ("gpt-5.5").'),
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
        "default, and any conditional rules governing when it applies. Use before writing " +
        "code that calls a model, or when building a model settings UI.",
      inputSchema: {
        model: z.string().describe('Catalog id ("openai/gpt-5.5") or bare model slug ("gpt-5.5").'),
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
    "find_models_supporting",
    {
      title: "Find models supporting a parameter",
      description:
        'Find which models accept a given parameter, e.g. "reasoning_effort", ' +
        '"thinking.budget_tokens", or "top_k". Use to answer "which models support X" or to ' +
        "pick a model that exposes a knob you need.",
      inputSchema: {
        parameter: z.string().describe('Exact parameter path, e.g. "top_k" or "thinking.type".'),
        provider: z.string().optional().describe("Restrict to one provider slug."),
        limit: z.number().int().positive().max(1000).optional().describe("Default 100."),
      },
      annotations: READ_ONLY,
    },
    async (args) => reply(findModelsSupporting(args)),
  );

  return server;
}
