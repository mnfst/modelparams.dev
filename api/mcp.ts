// POST /mcp — the modelparams catalog as an MCP server over Streamable HTTP.
//
// Same four tools as the `modelparams-mcp` npm package, built by the same
// `createServer()` factory; only the transport differs. The stdio package pins
// an exact catalog version at publish time, so a model added today reaches
// those users only after they upgrade. This endpoint is rebuilt with the site
// on every merge to main, so it answers from the catalog the site is serving.
//
// Stateless by design: no session ids, no server-initiated streams, one server
// instance per request. All four tools are read-only request/response, so
// nothing needs to survive between calls, and every request can land on a
// different serverless instance without coordination.
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { createServer } from "../packages/modelparams-mcp/src/server.js";

const MAX_BODY_BYTES = 256 * 1024;

// Vercel exposes the deployment sha; the catalog is whatever that build carried,
// so it is the honest answer to "which version am I talking to?".
const VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
} as const;

const USAGE = {
  endpoint: "POST /mcp",
  description:
    "MCP server for the modelparams.dev catalog, over Streamable HTTP. Answers what " +
    "parameters a model accepts, and validates a params object before you send it.",
  transport: "streamable-http",
  stateless: true,
  tools: ["validate_model_params", "get_model_params", "list_models", "list_provider_models"],
  install: {
    "claude-code": "claude mcp add --transport http modelparams https://modelparams.dev/mcp",
    codex: "codex mcp add modelparams --url https://modelparams.dev/mcp",
  },
  docs: "https://modelparams.dev/api",
} as const;

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body, null, 2) + "\n", {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Every response is specific to one JSON-RPC call, so no shared cache may
      // hold it — unlike the static catalog endpoints under /api/v1.
      "Cache-Control": "no-store",
      ...CORS,
      ...headers,
    },
  });
}

function rpcError(id: string | number | null, code: number, message: string, status: number) {
  return json({ jsonrpc: "2.0", id, error: { code, message } }, status);
}

/**
 * Carries exactly one JSON-RPC message into an McpServer and hands back what
 * the server replies. The SDK's own HTTP transport wants Node's `req`/`res`
 * objects, which this function never sees — Vercel hands it a web `Request`.
 */
class SingleMessageTransport implements Transport {
  onmessage?: (message: JSONRPCMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;

  private resolve?: (message: JSONRPCMessage) => void;

  async start(): Promise<void> {}

  async send(message: JSONRPCMessage): Promise<void> {
    this.resolve?.(message);
  }

  async close(): Promise<void> {
    this.onclose?.();
  }

  /** Resolves with the server's reply, or null when the input was a notification. */
  async exchange(message: JSONRPCMessage): Promise<JSONRPCMessage | null> {
    const isRequest = "id" in message && message.id !== null && message.id !== undefined;
    if (!isRequest) {
      this.onmessage?.(message);
      return null;
    }
    const reply = new Promise<JSONRPCMessage>((resolve) => {
      this.resolve = resolve;
    });
    this.onmessage?.(message);
    return await reply;
  }
}

async function readMessage(request: Request): Promise<JSONRPCMessage> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    throw new RangeError(`request body exceeds ${MAX_BODY_BYTES} bytes`);
  }
  if (raw.trim() === "") throw new SyntaxError("request body is empty");
  const parsed: unknown = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    // Batching left the protocol in the 2025-06-18 revision; say so rather than
    // silently answering the first message in the array.
    throw new SyntaxError("JSON-RPC batches are not supported");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new SyntaxError("request body must be a JSON-RPC message object");
  }
  return parsed as JSONRPCMessage;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // A GET is either an MCP client opening the optional server-to-client
    // stream, which a stateless server has nothing to put on, or a person
    // opening the URL. Answer each in its own terms: event-stream clients get
    // a 405, everyone else gets the JSON usage object.
    if (request.method === "GET") {
      if ((request.headers.get("accept") ?? "").includes("text/event-stream")) {
        return json({ error: "streaming_not_supported", usage: USAGE }, 405, { Allow: "POST" });
      }
      return json(USAGE);
    }

    if (request.method !== "POST") {
      return json({ error: "method_not_allowed", usage: USAGE }, 405, {
        Allow: "POST, GET, OPTIONS",
      });
    }

    let message: JSONRPCMessage;
    try {
      message = await readMessage(request);
    } catch (err) {
      const status = err instanceof RangeError ? 413 : 400;
      return rpcError(null, -32700, (err as Error).message, status);
    }

    const server = createServer(VERSION);
    const transport = new SingleMessageTransport();
    try {
      await server.connect(transport);
      const reply = await transport.exchange(message);
      // A notification gets no body: the client is telling us something
      // (`notifications/initialized`), not asking.
      if (reply === null) return new Response(null, { status: 202, headers: CORS });
      return json(reply);
    } catch (err) {
      const id = "id" in message ? ((message.id as string | number | null) ?? null) : null;
      return rpcError(id, -32603, (err as Error).message, 500);
    } finally {
      await server.close();
    }
  },
};
