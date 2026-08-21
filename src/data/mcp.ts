/** The MCP protocol endpoint. Browsers get the docs page here; machines get the protocol. */
export const MCP_ENDPOINT = "https://modelparams.dev/mcp";

export interface McpClient {
  id: string;
  name: string;
  /** How the install instruction is shown: a one-liner or a JSON config. */
  kind: "cli" | "json";
  command: string;
  note?: string;
}

export const MCP_CLIENTS: McpClient[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    kind: "cli",
    command: `claude mcp add --transport http modelparams ${MCP_ENDPOINT}`,
  },
  {
    id: "codex",
    name: "Codex",
    kind: "cli",
    command: `codex mcp add modelparams --url ${MCP_ENDPOINT}`,
  },
  {
    id: "opencode",
    name: "OpenCode",
    kind: "json",
    command: JSON.stringify(
      {
        mcp: {
          modelparams: { type: "remote", url: MCP_ENDPOINT, enabled: true },
        },
      },
      null,
      2,
    ),
    note: "Add to opencode.json under `mcp`.",
  },
  {
    id: "mcp-spec",
    name: "Claude Desktop, Cursor, Windsurf, Zed",
    kind: "json",
    command: JSON.stringify(
      {
        mcpServers: {
          modelparams: { type: "http", url: MCP_ENDPOINT },
        },
      },
      null,
      2,
    ),
    note: "Any client that takes a JSON `mcpServers` block.",
  },
];

export interface McpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  example: Record<string, unknown>;
}

const STRING = { type: "string" } as const;
const OPTIONAL_STRING = { type: "string" } as const;
const OPTIONAL_INTEGER = { type: "integer", minimum: 1 } as const;

export const MCP_TOOLS: McpTool[] = [
  {
    name: "validate_model_params",
    title: "Validate model parameters",
    description:
      "Check a set of request parameters against what a model actually accepts, before you call it. " +
      "Catches unknown parameters, out-of-range values, and combinations the provider rejects — " +
      "such as top_p alongside a non-default temperature on Anthropic models. Returns a corrected " +
      "`safeParams` payload that is guaranteed to validate.",
    inputSchema: {
      type: "object",
      properties: {
        model: {
          ...STRING,
          description:
            "Catalog id or bare model slug, or with baseUrl the wire string your SDK sends.",
        },
        baseUrl: {
          ...OPTIONAL_STRING,
          description: 'The base URL your SDK uses, e.g. "https://api.fireworks.ai/inference/v1".',
        },
        params: {
          type: "object",
          additionalProperties: true,
          description: 'Provider-native parameter paths to values, e.g. {"temperature": 0.7}.',
        },
      },
      required: ["model"],
      additionalProperties: false,
    },
    example: {
      model: "anthropic/claude-3-opus-20240229",
      valid: false,
      summary:
        "1 parameter(s) would be rejected or silently ignored by anthropic/claude-3-opus-20240229.",
      issues: [
        {
          path: "top_p",
          code: "not_applicable",
          message: "top_p does not apply when temperature ≠ 1",
          conflictsWith: ["temperature"],
        },
      ],
      safeParams: { temperature: 0.5 },
    },
  },
  {
    name: "get_model_params",
    title: "Get model parameters",
    description:
      "Every parameter one model accepts — type, allowed range or enum values, default, and the " +
      "conditional rules that gate it. Also returns lifecycle status and migration guidance when tracked.",
    inputSchema: {
      type: "object",
      properties: {
        model: {
          ...STRING,
          description:
            "Catalog id or bare model slug, or with baseUrl the wire string your SDK sends.",
        },
        baseUrl: { ...OPTIONAL_STRING, description: "The base URL your SDK uses." },
      },
      required: ["model"],
      additionalProperties: false,
    },
    example: {
      model: "anthropic/claude-opus-4-8",
      provider: "anthropic",
      authType: "api_key",
      status: "active",
      parameterCount: 6,
      params: [
        {
          path: "temperature",
          type: "number",
          default: 1,
          range: { min: 0, max: 1 },
          group: "sampling",
        },
      ],
      defaults: { temperature: 1 },
      docs: "https://modelparams.dev/models/anthropic/claude-opus-4-8",
    },
  },
  {
    name: "list_models",
    title: "List catalog models",
    description:
      "Model ids in the catalog, optionally filtered by provider or a substring. Use it to resolve " +
      "the exact id the other tools expect.",
    inputSchema: {
      type: "object",
      properties: {
        provider: {
          ...OPTIONAL_STRING,
          description: 'Restrict to one provider slug, e.g. "anthropic".',
        },
        query: {
          ...OPTIONAL_STRING,
          description: "Case-insensitive substring match on the model id.",
        },
        limit: { ...OPTIONAL_INTEGER, description: "Default 100." },
      },
      additionalProperties: false,
    },
    example: {
      total: 382,
      returned: 3,
      truncated: false,
      providers: ["alibaba", "anthropic", "bedrock"],
      models: [
        "anthropic/claude-opus-4-8",
        "anthropic/claude-sonnet-4-6",
        "anthropic/claude-haiku-4-5",
      ],
    },
  },
  {
    name: "list_provider_models",
    title: "List a provider's models and their parameters",
    description:
      "Everything one provider serves in one call: its models, the wire id each one needs, their " +
      "lifecycle status, and the parameter surfaces they expose. Models that share a surface share a " +
      "profile, so a provider with dozens of models stays small enough to read. Use it to pick a model " +
      "and configure it in one step — especially on Bedrock and Vertex, where parameter paths differ " +
      "from the model's native API.",
    inputSchema: {
      type: "object",
      properties: {
        provider: {
          ...STRING,
          description: 'Provider slug, e.g. "bedrock", "vertex", "anthropic".',
        },
        query: {
          ...OPTIONAL_STRING,
          description: "Case-insensitive substring match on the model id.",
        },
        limit: { ...OPTIONAL_INTEGER, description: "Default 200." },
      },
      required: ["provider"],
      additionalProperties: false,
    },
    example: {
      provider: "bedrock",
      baseUrls: ["https://bedrock-runtime.*.amazonaws.com"],
      total: 56,
      returned: 56,
      truncated: false,
      paramProfiles: [
        {
          id: "p1",
          modelCount: 41,
          parameterCount: 4,
          params: [{ path: "inferenceConfig.maxTokens", type: "integer", range: { min: 1 } }],
          defaults: {},
        },
      ],
      models: [
        {
          model: "bedrock/claude-opus-4-6",
          authType: "api_key",
          wireId: "{scope}.anthropic.claude-opus-4-6-v1",
          profile: "p2",
        },
      ],
      wireIdNote: "A wireId containing {scope} needs one substitution before you send it…",
    },
  },
];
