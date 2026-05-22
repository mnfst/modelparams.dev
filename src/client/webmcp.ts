// Exposes the catalog to in-browser agents via the WebMCP API
// (window.navigator.modelContext). See https://github.com/webmachinelearning/webmcp.
// Standalone by design: it talks to the JSON API and the DOM, so it pulls no
// server-side modules (and no zod) into the client bundle.

type AuthType = "api_key" | "subscription";

interface CatalogParam {
  path: string;
  type: string;
  group: string;
  description: string;
  default?: unknown;
  values?: unknown[];
}

interface CatalogModel {
  provider: string;
  authType: AuthType;
  model: string;
  params: CatalogParam[];
}

interface Catalog {
  count: number;
  generatedAt?: string;
  models: CatalogModel[];
}

interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (params: Record<string, unknown>) => Promise<ToolResponse> | ToolResponse;
}

interface ModelContext {
  provideContext?: (context: { tools: ToolDefinition[] }) => void;
}

function modelId(model: CatalogModel): string {
  const suffix = model.authType === "subscription" ? "-subscription" : "";
  return `${model.provider}/${model.model}${suffix}`;
}

let catalogPromise: Promise<Catalog> | null = null;

function getCatalog(): Promise<Catalog> {
  if (!catalogPromise) {
    catalogPromise = fetch("/api/v1/models.json")
      .then((res) => {
        if (!res.ok) throw new Error(`catalog fetch failed (${res.status})`);
        return res.json() as Promise<Catalog>;
      })
      .catch((err) => {
        catalogPromise = null;
        throw err;
      });
  }
  return catalogPromise;
}

function ok(payload: unknown): ToolResponse {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  const single = asString(value);
  return single ? [single] : [];
}

// Mirror the agent's query onto the visible filter controls so a human watching
// the page sees what the agent searched for. Best-effort: it drives the same
// buttons/inputs a person would, and silently skips controls that aren't present.
function reflectInUi(filters: {
  query?: string;
  auth?: string;
  providers: string[];
  capabilities: string[];
}): void {
  const search = document.querySelector<HTMLInputElement>("[data-search]");
  if (search && filters.query !== undefined) {
    search.value = filters.query;
    search.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (filters.auth) {
    document.querySelector<HTMLButtonElement>(`[data-auth-filter="${filters.auth}"]`)?.click();
  }
  setToggleGroup("[data-provider]", "provider", filters.providers);
  setToggleGroup("[data-capability]", "capability", filters.capabilities);
}

function setToggleGroup(selector: string, key: string, wanted: string[]): void {
  if (wanted.length === 0) return;
  const want = new Set(wanted);
  document.querySelectorAll<HTMLButtonElement>(selector).forEach((btn) => {
    const value = btn.dataset[key] ?? "";
    const active = btn.dataset.active === "true";
    if (want.has(value) !== active) btn.click();
  });
}

function searchModels(catalog: Catalog, params: Record<string, unknown>) {
  const query = asString(params.query)?.toLowerCase();
  const auth = asString(params.auth);
  const providers = asStringList(params.provider);
  const capabilities = asStringList(params.capability);
  const limit = typeof params.limit === "number" ? Math.max(1, Math.floor(params.limit)) : 25;

  const matches = catalog.models.filter((model) => {
    if (auth && auth !== "all" && model.authType !== auth) return false;
    if (providers.length > 0 && !providers.includes(model.provider)) return false;
    const paths = new Set(model.params.map((p) => p.path));
    if (!capabilities.every((cap) => paths.has(cap))) return false;
    if (query) {
      const haystack = `${model.model} ${model.provider} ${modelId(model)}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  reflectInUi({ query: asString(params.query) ?? "", auth, providers, capabilities });

  return {
    total: matches.length,
    returned: Math.min(matches.length, limit),
    truncated: matches.length > limit,
    models: matches.slice(0, limit).map((model) => ({
      id: modelId(model),
      provider: model.provider,
      model: model.model,
      authType: model.authType,
      parameterCount: model.params.length,
      parameters: model.params.map((p) => p.path),
    })),
  };
}

async function getModelParameters(params: Record<string, unknown>): Promise<ToolResponse> {
  const id = asString(params.id);
  if (!id) return ok({ error: "Provide an `id` such as anthropic/claude-opus-4-7." });
  const res = await fetch(`/api/v1/models/${id}.json`);
  if (!res.ok) return ok({ error: `No model with id "${id}" (HTTP ${res.status}).` });
  return ok(await res.json());
}

function usageGuideText(): string {
  const embedded = document.getElementById("how-to-use-md")?.textContent?.trim();
  return embedded && embedded.length > 0
    ? embedded
    : "Usage guide unavailable on this page; fetch /llms-full.txt instead.";
}

function buildTools(): ToolDefinition[] {
  return [
    {
      name: "search_models",
      description:
        "Search the LLM parameter catalog. Filter by free-text query, provider slug, " +
        "required parameter path(s), and auth type (api_key | subscription | all). Also " +
        "mirrors the query onto the page's visible filters. Returns matching model ids.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text match on model name, provider, or id." },
          provider: {
            type: "string",
            description: "Provider slug, e.g. anthropic, openai, deepseek.",
          },
          capability: {
            type: "array",
            items: { type: "string" },
            description: "Parameter path(s) the model must support, e.g. thinking.type.",
          },
          auth: {
            type: "string",
            enum: ["all", "api_key", "subscription"],
            description: "Auth variant to include. Defaults to all.",
          },
          limit: { type: "number", description: "Max models to return (default 25)." },
        },
      },
      execute: async (params) => ok(searchModels(await getCatalog(), params)),
    },
    {
      name: "get_model_parameters",
      description:
        "Fetch the full parameter set for one model by id (e.g. anthropic/claude-opus-4-7, " +
        "or append -subscription for the subscription variant). Returns every parameter with " +
        "type, default, range, allowed values, and applicability conditions.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Model id: provider/model[-subscription]." },
        },
        required: ["id"],
      },
      execute: getModelParameters,
    },
    {
      name: "list_providers",
      description: "List every provider in the catalog with its model count.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const catalog = await getCatalog();
        const counts = new Map<string, number>();
        for (const model of catalog.models) {
          counts.set(model.provider, (counts.get(model.provider) ?? 0) + 1);
        }
        const providers = [...counts.entries()]
          .map(([provider, count]) => ({ provider, count }))
          .sort((a, b) => b.count - a.count || a.provider.localeCompare(b.provider));
        return ok({ total: providers.length, providers });
      },
    },
    {
      name: "list_parameters",
      description:
        "List every parameter path documented across the catalog with how many models expose it.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const catalog = await getCatalog();
        const counts = new Map<string, number>();
        for (const model of catalog.models) {
          for (const path of new Set(model.params.map((p) => p.path))) {
            counts.set(path, (counts.get(path) ?? 0) + 1);
          }
        }
        const parameters = [...counts.entries()]
          .map(([path, count]) => ({ path, count }))
          .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
        return ok({ total: parameters.length, parameters });
      },
    },
    {
      name: "get_usage_guide",
      description:
        "Return the modelparams.dev usage guide as Markdown: how to call the API, the " +
        "JSON Schema, logos, and how to contribute. Hand this to a coding agent verbatim.",
      inputSchema: { type: "object", properties: {} },
      execute: () => ({ content: [{ type: "text", text: usageGuideText() }] }),
    },
  ];
}

export function setupWebMCP(): void {
  const context = (window.navigator as Navigator & { modelContext?: ModelContext }).modelContext;
  if (!context || typeof context.provideContext !== "function") return;
  try {
    context.provideContext({ tools: buildTools() });
  } catch {
    /* a stricter host may reject the registration; degrade to plain HTML/JSON */
  }
}
