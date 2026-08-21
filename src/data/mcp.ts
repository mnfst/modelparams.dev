/** The MCP protocol endpoint. Browsers get the docs page here; machines get the protocol. */
export const MCP_ENDPOINT = "https://modelparams.dev/mcp";

export interface McpClient {
  id: string;
  name: string;
  /** Inline SVG logo (monochrome `currentColor` or brand colors). */
  logo: string;
  /** How the install instruction is shown: a one-liner or a JSON config. */
  kind: "cli" | "json";
  command: string;
  note?: string;
}

const CLAUDE_CODE_LOGO =
  '<svg height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" fill="#D97757" fill-rule="evenodd"></path></svg>';

const CODEX_LOGO =
  '<svg height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M19.503 0H4.496A4.496 4.496 0 000 4.496v15.007A4.496 4.496 0 004.496 24h15.007A4.496 4.496 0 0024 19.503V4.496A4.496 4.496 0 0019.503 0z" fill="#fff"></path><path d="M9.064 3.344a4.578 4.578 0 012.285-.312c1 .115 1.891.54 2.673 1.275.01.01.024.017.037.021a.09.09 0 00.043 0 4.55 4.55 0 013.046.275l.047.022.116.057a4.581 4.581 0 012.188 2.399c.209.51.313 1.041.315 1.595a4.24 4.24 0 01-.134 1.223.123.123 0 00.03.115c.594.607.988 1.33 1.183 2.17.289 1.425-.007 2.71-.887 3.854l-.136.166a4.548 4.548 0 01-2.201 1.388.123.123 0 00-.081.076c-.191.551-.383 1.023-.74 1.494-.9 1.187-2.222 1.846-3.711 1.838-1.187-.006-2.239-.44-3.157-1.302a.107.107 0 00-.105-.024c-.388.125-.78.143-1.204.138a4.441 4.441 0 01-1.945-.466 4.544 4.544 0 01-1.61-1.335c-.152-.202-.303-.392-.414-.617a5.81 5.81 0 01-.37-.961 4.582 4.582 0 01-.014-2.298.124.124 0 00.006-.056.085.085 0 00-.027-.048 4.467 4.467 0 01-1.034-1.651 3.896 3.896 0 01-.251-1.192 5.189 5.189 0 01.141-1.6c.337-1.112.982-1.985 1.933-2.618.212-.141.413-.251.601-.33.215-.089.43-.164.646-.227a.098.098 0 00.065-.066 4.51 4.51 0 01.829-1.615 4.535 4.535 0 011.837-1.388zm3.482 10.565a.637.637 0 000 1.272h3.636a.637.637 0 100-1.272h-3.636zM8.462 9.23a.637.637 0 00-1.106.631l1.272 2.224-1.266 2.136a.636.636 0 101.095.649l1.454-2.455a.636.636 0 00.005-.64L8.462 9.23z" fill="url(#lobe-icons-codex-_R_0_)"></path><defs><linearGradient gradientUnits="userSpaceOnUse" id="lobe-icons-codex-_R_0_" x1="12" x2="12" y1="3" y2="21"><stop stop-color="#B1A7FF"></stop><stop offset=".5" stop-color="#7A9DFF"></stop><stop offset="1" stop-color="#3941FF"></stop></linearGradient></defs></svg>';

const OPENCODE_LOGO =
  '<svg fill="currentColor" fill-rule="evenodd" height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M16 6H8v12h8V6zm4 16H4V2h16v20z"></path></svg>';

const CURSOR_LOGO =
  '<svg fill="currentColor" fill-rule="evenodd" height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M22.106 5.68L12.5.135a.998.998 0 00-.998 0L1.893 5.68a.84.84 0 00-.419.726v11.186c0 .3.16.577.42.727l9.607 5.547a.999.999 0 00.998 0l9.608-5.547a.84.84 0 00.42-.727V6.407a.84.84 0 00-.42-.726zm-.603 1.176L12.228 22.92c-.063.108-.228.064-.228-.061V12.34a.59.59 0 00-.295-.51l-9.11-5.26c-.107-.062-.063-.228.062-.228h18.55c.264 0 .428.286.296.514z"></path></svg>';

const WINDSURF_LOGO =
  '<svg fill="currentColor" fill-rule="evenodd" height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="M23.78 5.004h-.228a2.187 2.187 0 00-2.18 2.196v4.912c0 .98-.804 1.775-1.76 1.775a1.818 1.818 0 01-1.472-.773L13.168 5.95a2.197 2.197 0 00-1.81-.95c-1.134 0-2.154.972-2.154 2.173v4.94c0 .98-.797 1.775-1.76 1.775-.57 0-1.136-.289-1.472-.773L.408 5.098C.282 4.918 0 5.007 0 5.228v4.284c0 .216.066.426.188.604l5.475 7.889c.324.466.8.812 1.351.938 1.377.316 2.645-.754 2.645-2.117V11.89c0-.98.787-1.775 1.76-1.775h.002c.586 0 1.135.288 1.472.773l4.972 7.163a2.15 2.15 0 001.81.95c1.158 0 2.151-.973 2.151-2.173v-4.939c0-.98.787-1.775 1.76-1.775h.194c.122 0 .22-.1.22-.222V5.225a.221.221 0 00-.22-.222z"></path></svg>';

const GENERIC_LOGO =
  '<svg fill="none" height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>';

const MCP_SERVERS_JSON = JSON.stringify(
  {
    mcpServers: {
      modelparams: { type: "http", url: MCP_ENDPOINT },
    },
  },
  null,
  2,
);

export const MCP_CLIENTS: McpClient[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    logo: CLAUDE_CODE_LOGO,
    kind: "cli",
    command: `claude mcp add --transport http modelparams ${MCP_ENDPOINT}`,
  },
  {
    id: "codex",
    name: "Codex",
    logo: CODEX_LOGO,
    kind: "cli",
    command: `codex mcp add modelparams --url ${MCP_ENDPOINT}`,
  },
  {
    id: "opencode",
    name: "OpenCode",
    logo: OPENCODE_LOGO,
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
    id: "cursor",
    name: "Cursor",
    logo: CURSOR_LOGO,
    kind: "json",
    command: MCP_SERVERS_JSON,
    note: "Cursor Settings → MCP → add a server.",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    logo: WINDSURF_LOGO,
    kind: "json",
    command: MCP_SERVERS_JSON,
    note: "Any client that takes a JSON `mcpServers` block.",
  },
  {
    id: "other",
    name: "Claude Desktop, Zed, …",
    logo: GENERIC_LOGO,
    kind: "json",
    command: MCP_SERVERS_JSON,
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
          description: "Catalog id, bare slug, or wire string with baseUrl.",
        },
        baseUrl: {
          ...OPTIONAL_STRING,
          description: "The base URL your SDK uses.",
        },
        params: {
          type: "object",
          additionalProperties: true,
          description: "Provider-native parameter paths to values.",
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
          description: "Catalog id, bare slug, or wire string with baseUrl.",
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
