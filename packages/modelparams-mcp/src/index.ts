#!/usr/bin/env node
import { createRequire } from "node:module";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

// The release workflow rewrites package.json's version; read it there so the
// MCP handshake always reports the shipped version.
const PKG_VERSION: string = (
  createRequire(import.meta.url)("../package.json") as { version: string }
).version;

export { createServer } from "./server.js";
export * from "./tools.js";

async function main(): Promise<void> {
  const server = createServer(PKG_VERSION);
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
