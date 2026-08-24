// providers.yaml — the base URLs an SDK configures to reach each provider.
// Only endpoints the catalog's prober actually drives are listed.
import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { fileURLToPath } from "node:url";

const FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "providers.yaml",
);

const Endpoints = z.record(
  z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "provider must be a kebab-case slug"),
  z.array(z.string().url()).min(1),
);

export function loadProviderEndpoints(): Record<string, string[]> {
  const raw = parse(fs.readFileSync(FILE, "utf8")) as unknown;
  return Endpoints.parse(raw);
}
