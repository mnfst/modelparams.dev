import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { MODELS_DIR } from "../data/paths.js";
import { applyLifecycle, indexDeprecations, keyOf } from "./status.js";

const DEFAULT_URL = "https://modeldeprecations.dev/api/v1/models.json";

interface DeprecationsPayload {
  models: unknown[];
}

async function walkYamlFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walkYamlFiles(full)));
    else if (entry.isFile() && /\.(ya?ml)$/i.test(entry.name)) found.push(full);
  }
  return found.sort();
}

function readIdentity(file: string, raw: unknown): { provider: string; model: string } | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const { provider, model } = raw as { provider?: unknown; model?: unknown };
  if (typeof provider !== "string" || typeof model !== "string") return undefined;
  return { provider, model };
}

async function main(): Promise<void> {
  const urlIndex = process.argv.indexOf("--url");
  const url = urlIndex === -1 ? DEFAULT_URL : (process.argv[urlIndex + 1] ?? DEFAULT_URL);

  const response = await fetch(url, {
    headers: { "user-agent": "modelparams.dev lifecycle sync/1.0" },
  });
  if (!response.ok) {
    throw new Error(`fetch ${url} returned HTTP ${response.status}`);
  }
  const payload = (await response.json()) as DeprecationsPayload;
  const index = indexDeprecations(payload.models);

  const files = await walkYamlFiles(MODELS_DIR);
  let matched = 0;
  let changed = 0;
  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    let raw: unknown;
    try {
      raw = yaml.load(text, { schema: yaml.JSON_SCHEMA });
    } catch {
      continue;
    }
    const identity = readIdentity(file, raw);
    if (!identity) continue;
    const record = index.get(keyOf(identity.provider, identity.model));
    if (!record) continue;
    matched += 1;

    const next = applyLifecycle(text, record);
    if (next !== text) {
      await fs.writeFile(file, next, "utf8");
      changed += 1;
    }
  }

  console.log(`Lifecycle sync: ${matched} model(s) matched, ${changed} file(s) changed.`);
}

main().catch((error) => {
  console.error(`Lifecycle sync failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
