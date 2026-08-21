import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { getModel } from "modelparams";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";

let client: Client;

interface ParamInfo {
  path: string;
  type: string;
  values?: string[];
  appliesOnlyWhen?: unknown;
}

interface ValidateResult {
  model: string;
  provider: string;
  valid: boolean;
  summary: string;
  issues: { path: string; code: string; message: string; conflictsWith?: string[] }[];
  safeParams: Record<string, unknown>;
  error?: string;
  suggestions?: string[];
}

interface ModelParamsResult {
  model: string;
  status?: "active" | "deprecated" | "retired";
  replacement?: string;
  shutdownOn?: string;
  parameterCount: number;
  params: ParamInfo[];
}

interface ListResult {
  total: number;
  truncated: boolean;
  models: string[];
  providers: string[];
  error?: string;
}

interface ProviderModelsResult {
  provider: string;
  baseUrls: string[];
  total: number;
  returned: number;
  truncated: boolean;
  paramProfiles: {
    id: string;
    modelCount: number;
    parameterCount: number;
    params: ParamInfo[];
    defaults: Record<string, unknown>;
  }[];
  models: {
    model: string;
    authType: string;
    wireId?: string;
    profile: string;
    status?: string;
    replacement?: string;
    shutdownOn?: string;
  }[];
  wireIdNote?: string;
  error?: string;
  providers?: string[];
}

/** Parse the JSON payload a tool replies with. */
async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const result = (await client.callTool({ name, arguments: args })) as {
    content: { type: string; text: string }[];
  };
  return JSON.parse(result.content[0]!.text) as T;
}

beforeEach(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([createServer().connect(serverTransport), client.connect(clientTransport)]);
});

afterEach(async () => {
  await client.close();
});

describe("tool discovery", () => {
  it("advertises the four catalog tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_model_params",
      "list_models",
      "list_provider_models",
      "validate_model_params",
    ]);
  });

  it("marks every tool read-only", async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
    }
  });

  it("describes each tool well enough for an agent to choose it", async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.description!.length, tool.name).toBeGreaterThan(80);
    }
  });
});

describe("validate_model_params", () => {
  it("passes a valid request", async () => {
    const out = await call<ValidateResult>("validate_model_params", {
      model: "anthropic/claude-3-opus-20240229",
      params: { max_tokens: 1024, temperature: 1 },
    });
    expect(out.valid).toBe(true);
    expect(out.issues).toEqual([]);
  });

  it("catches a conditional conflict and returns a corrected payload", async () => {
    const out = await call<ValidateResult>("validate_model_params", {
      model: "anthropic/claude-3-opus-20240229",
      params: { temperature: 0.5, top_p: 0.9, max_tokens: 1024 },
    });
    expect(out.valid).toBe(false);
    expect(out.issues[0]!.path).toBe("top_p");
    expect(out.issues[0]!.code).toBe("not_applicable");
    expect(out.safeParams).toEqual({ temperature: 0.5, max_tokens: 1024 });
  });

  it("catches a parameter the model does not expose", async () => {
    const out = await call<ValidateResult>("validate_model_params", {
      model: "openai/gpt-5.5",
      params: { temperature: 0.7 },
    });
    expect(out.valid).toBe(false);
    expect(out.issues[0]!.code).toBe("unknown_parameter");
  });

  it("treats an omitted params object as an empty request", async () => {
    const out = await call<ValidateResult>("validate_model_params", { model: "openai/gpt-5.5" });
    expect(out.valid).toBe(true);
  });

  it("resolves a bare model slug when it is unambiguous", async () => {
    const out = await call<ValidateResult>("validate_model_params", {
      model: "gpt-5.5",
      params: {},
    });
    expect(out.model).toBe("openai/gpt-5.5");
    expect(out.valid).toBe(true);
  });

  it("reports an ambiguous bare slug with the qualified ids", async () => {
    const out = await call<ValidateResult>("validate_model_params", {
      model: "kimi-k3",
      params: {},
    });
    expect(out.error).toBe("ambiguous_model");
    expect(out.matches).toContain("fireworks/kimi-k3");
    expect(out.matches).toContain("moonshot/kimi-k3");
  });

  it("guides recovery from an unknown model", async () => {
    const out = await call<ValidateResult>("validate_model_params", {
      model: "anthropic/claude-opus-9",
      params: {},
    });
    expect(out.error).toBe("unknown_model");
    expect(Array.isArray(out.suggestions)).toBe(true);
  });
});

describe("get_model_params", () => {
  it("returns typed parameters and defaults", async () => {
    const out = await call<ModelParamsResult>("get_model_params", { model: "openai/gpt-5.5" });
    expect(out.model).toBe("openai/gpt-5.5");
    expect(out.status).toBe("active");
    expect(out.parameterCount).toBeGreaterThan(0);
    const effort = out.params.find((p) => p.path === "reasoning_effort");
    expect(effort!.type).toBe("enum");
    expect(effort!.values).toContain("low");
  });

  it("surfaces conditional rules", async () => {
    const out = await call<ModelParamsResult>("get_model_params", {
      model: "anthropic/claude-opus-4-7",
    });
    const display = out.params.find((p) => p.path === "thinking.display");
    expect(display!.appliesOnlyWhen).toBeDefined();
  });

  it("returns tracked lifecycle metadata at the top level", async () => {
    const entry = getModel("openai/gpt-5.5") as unknown as Record<string, unknown>;
    const previous = {
      status: entry.status,
      replacement: entry.replacement,
      shutdownOn: entry.shutdownOn,
    };

    Object.assign(entry, {
      status: "deprecated",
      replacement: "openai/gpt-5.6-sol",
      shutdownOn: "2026-10-23",
    });

    try {
      const out = await call<ModelParamsResult>("get_model_params", {
        model: "openai/gpt-5.5",
      });
      expect(out).toMatchObject({
        status: "deprecated",
        replacement: "openai/gpt-5.6-sol",
        shutdownOn: "2026-10-23",
      });
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete entry[key];
        else entry[key] = value;
      }
    }
  });
});

describe("list_models", () => {
  it("lists the whole catalog", async () => {
    const out = await call<ListResult>("list_models", {});
    expect(out.total).toBeGreaterThan(200);
  });

  it("filters by provider", async () => {
    const out = await call<ListResult>("list_models", { provider: "anthropic" });
    expect(out.total).toBeGreaterThan(0);
    expect(out.models.every((m) => m.startsWith("anthropic/"))).toBe(true);
  });

  it("filters by substring", async () => {
    const out = await call<ListResult>("list_models", { query: "opus" });
    expect(out.models.every((m) => m.includes("opus"))).toBe(true);
  });

  it("reports an unknown provider with the valid set", async () => {
    const out = await call<ListResult>("list_models", { provider: "nope" });
    expect(out.error).toBe("unknown_provider");
    expect(out.providers).toContain("openai");
  });

  it("flags truncation rather than silently cutting off", async () => {
    const out = await call<ListResult>("list_models", { limit: 5 });
    expect(out.models).toHaveLength(5);
    expect(out.truncated).toBe(true);
  });
});

describe("list_provider_models", () => {
  it("returns a provider's whole surface in one call", async () => {
    const out = await call<ProviderModelsResult>("list_provider_models", { provider: "bedrock" });
    expect(out.provider).toBe("bedrock");
    expect(out.total).toBeGreaterThan(10);
    expect(out.truncated).toBe(false);
    expect(out.models).toHaveLength(out.total);
    expect(out.baseUrls.length).toBeGreaterThan(0);
  });

  it("collapses shared parameter surfaces into far fewer profiles than models", async () => {
    const out = await call<ProviderModelsResult>("list_provider_models", { provider: "bedrock" });
    expect(out.paramProfiles.length).toBeLessThan(out.models.length / 4);
    // Commonest surface first, so p1 is the provider's house style.
    expect(out.paramProfiles[0]!.id).toBe("p1");
    expect(out.paramProfiles[0]!.modelCount).toBeGreaterThanOrEqual(
      out.paramProfiles[out.paramProfiles.length - 1]!.modelCount,
    );
  });

  it("points every model at a profile that exists", async () => {
    const out = await call<ProviderModelsResult>("list_provider_models", { provider: "vertex" });
    const ids = new Set(out.paramProfiles.map((p) => p.id));
    expect(out.models.every((m) => ids.has(m.profile))).toBe(true);
  });

  it("groups models by surface rather than by name", async () => {
    const out = await call<ProviderModelsResult>("list_provider_models", { provider: "bedrock" });
    const byProfile = new Map<string, ParamInfo[]>();
    for (const profile of out.paramProfiles) byProfile.set(profile.id, profile.params);
    // Two models on the same profile must agree parameter-for-parameter.
    const grouped = out.models.filter((m) => m.profile === "p1");
    expect(grouped.length).toBeGreaterThan(1);
    const paths = byProfile.get("p1")!.map((p) => p.path);
    expect(paths).toContain("inferenceConfig.maxTokens");
  });

  it("hands over the wire id, and flags the ones needing substitution", async () => {
    const out = await call<ProviderModelsResult>("list_provider_models", { provider: "bedrock" });
    const templated = out.models.find((m) => m.wireId?.includes("{scope}"));
    expect(templated).toBeDefined();
    expect(out.wireIdNote).toContain("{scope}");
  });

  it("omits the wire id note for a provider that has no placeholders", async () => {
    const out = await call<ProviderModelsResult>("list_provider_models", { provider: "openai" });
    expect(out.wireIdNote).toBeUndefined();
  });

  it("filters by substring", async () => {
    const out = await call<ProviderModelsResult>("list_provider_models", {
      provider: "bedrock",
      query: "claude",
    });
    expect(out.models.length).toBeGreaterThan(0);
    expect(out.models.every((m) => m.model.includes("claude"))).toBe(true);
  });

  it("flags truncation rather than silently cutting off", async () => {
    const out = await call<ProviderModelsResult>("list_provider_models", {
      provider: "bedrock",
      limit: 3,
    });
    expect(out.models).toHaveLength(3);
    expect(out.truncated).toBe(true);
    expect(out.total).toBeGreaterThan(3);
  });

  it("marks a model whose lifecycle is tracked", async () => {
    const entry = getModel("openai/gpt-5.5") as unknown as Record<string, unknown>;
    const previous = {
      status: entry.status,
      replacement: entry.replacement,
      shutdownOn: entry.shutdownOn,
    };

    Object.assign(entry, {
      status: "deprecated",
      replacement: "openai/gpt-5.6-sol",
      shutdownOn: "2026-10-23",
    });

    try {
      const out = await call<ProviderModelsResult>("list_provider_models", {
        provider: "openai",
        query: "gpt-5.5",
      });
      // An agent choosing from this list must see the retirement on the row it
      // is choosing from, not only if it looks the model up separately.
      expect(out.models.find((m) => m.model === "openai/gpt-5.5")).toMatchObject({
        status: "deprecated",
        replacement: "openai/gpt-5.6-sol",
        shutdownOn: "2026-10-23",
      });
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete entry[key];
        else entry[key] = value;
      }
    }
  });

  it("reports an unknown provider with the valid set", async () => {
    const out = await call<ProviderModelsResult>("list_provider_models", { provider: "aws" });
    expect(out.error).toBe("unknown_provider");
    expect(out.providers).toContain("bedrock");
  });
});
