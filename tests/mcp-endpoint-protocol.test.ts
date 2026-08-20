import http from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import handler from "../api/mcp.js";

// The unit tests above drive the handler with hand-written JSON-RPC. This one
// puts the real SDK client in front of it over real HTTP, which is what Claude
// Code and Codex do — protocol details we get wrong show up here, not there.
let server: http.Server;
let client: Client;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      void (async () => {
        const body = Buffer.concat(chunks);
        const response = await handler.fetch(
          new Request(`http://localhost${req.url ?? "/"}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
          }),
        );
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
      })();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;

  client = new Client({ name: "protocol-test", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://localhost:${port}/mcp`)));
});

afterAll(async () => {
  await client.close();
  server.close();
});

describe("the MCP endpoint over real HTTP", () => {
  it("completes the handshake a standard client performs", () => {
    expect(client.getServerVersion()?.name).toBe("modelparams");
  });

  it("advertises the four tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "get_model_params",
      "list_models",
      "list_provider_models",
      "validate_model_params",
    ]);
  });

  it("answers a tool call", async () => {
    const result = await client.callTool({
      name: "validate_model_params",
      arguments: { model: "anthropic/claude-opus-5", params: { temperature: 0.7 } },
    });
    const payload = JSON.parse((result.content as { text: string }[])[0]!.text) as {
      model: string;
      issues: unknown[];
    };
    expect(payload.model).toBe("anthropic/claude-opus-5");
    expect(Array.isArray(payload.issues)).toBe(true);
  });
});
