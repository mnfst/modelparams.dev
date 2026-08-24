import { describe, expect, it } from "vitest";
import handler from "../api/mcp.js";

const URL = "https://modelparams.dev/mcp";

async function rpc(body: unknown, init: RequestInit = {}): Promise<Response> {
  return await handler.fetch(
    new Request(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
      ...init,
    }),
  );
}

interface RpcReply {
  jsonrpc: string;
  id?: number | string | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

async function call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await rpc({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name, arguments: args },
  });
  const body = (await res.json()) as RpcReply;
  const content = (body.result as { content: { type: string; text: string }[] }).content;
  return JSON.parse(content[0]!.text) as Record<string, unknown>;
}

describe("POST /mcp", () => {
  it("completes the initialize handshake", async () => {
    const res = await rpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as RpcReply;
    const result = body.result as {
      serverInfo: { name: string };
      capabilities: Record<string, unknown>;
    };
    expect(result.serverInfo.name).toBe("modelparams");
    expect(result.capabilities.tools).toBeDefined();
  });

  it("lists the four catalog tools", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const body = (await res.json()) as RpcReply;
    const names = (body.result as { tools: { name: string }[] }).tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "get_model_params",
      "list_models",
      "list_provider_models",
      "validate_model_params",
    ]);
  });

  it("answers a real catalog question", async () => {
    const result = await call("get_model_params", { model: "openai/gpt-4" });
    expect(result.model).toBe("openai/gpt-4");
    expect(result.parameterCount as number).toBeGreaterThan(0);
  });

  it("validates params, which is the tool agents should call first", async () => {
    const result = await call("validate_model_params", {
      model: "openai/gpt-4",
      params: { temperature: 0.5, nonsense_param: 1 },
    });
    expect(result.valid).toBe(false);
    expect(JSON.stringify(result.issues)).toContain("nonsense_param");
    expect(result.safeParams).toEqual({ temperature: 0.5 });
  });

  it("serves the catalog the site was built from, not a pinned npm version", async () => {
    // The stdio package answers from `modelparams@<exact pin>`; this endpoint
    // answers from the build. A model merged today must be present here.
    const result = await call("list_models", { provider: "bedrock" });
    expect((result.models as string[]).length).toBeGreaterThan(0);
  });

  it("accepts a notification with no body", async () => {
    const res = await rpc({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });

  it("rejects a JSON-RPC batch instead of answering only its first message", async () => {
    const res = await rpc([{ jsonrpc: "2.0", id: 1, method: "tools/list" }]);
    expect(res.status).toBe(400);
    const body = (await res.json()) as RpcReply;
    expect(body.error?.message).toContain("batch");
  });

  it("rejects a malformed body", async () => {
    const res = await rpc("{not json");
    expect(res.status).toBe(400);
    expect(((await res.json()) as RpcReply).error?.code).toBe(-32700);
  });

  it("answers a browser GET with usage, and an SSE GET with 405", async () => {
    const usage = await handler.fetch(new Request(URL));
    expect(usage.status).toBe(200);
    expect(((await usage.json()) as { transport: string }).transport).toBe("streamable-http");

    const stream = await handler.fetch(
      new Request(URL, { headers: { Accept: "text/event-stream" } }),
    );
    expect(stream.status).toBe(405);
    expect(stream.headers.get("Allow")).toBe("POST");
  });

  it("never lets a shared cache hold a response", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: 3, method: "tools/list" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
