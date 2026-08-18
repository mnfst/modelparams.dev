#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

export { createServer } from "./server.js";
export * from "./tools.js";

async function main(): Promise<void> {
  const server = createServer();
  // stdout is the transport — anything written there that isn't a protocol
  // message corrupts the session, so diagnostics go to stderr.
  await server.connect(new StdioServerTransport());
  console.error("modelparams MCP server ready on stdio");
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;

if (isDirectRun) {
  main().catch((err) => {
    console.error("modelparams MCP server failed to start:", err);
    process.exit(1);
  });
}
