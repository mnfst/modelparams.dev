import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAllModels } from "../data/load.js";
import type { AuthType, Model, Parameter, ApplicabilityRule } from "../schema/model.js";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = Record<string, JsonValue>;

type Expected = "success" | "failure";

interface SmokeCase {
  name: string;
  params: JsonRecord;
  expected: Expected;
}

interface Options {
  provider?: string;
  model?: string;
  authType?: AuthType;
  keysFile?: string;
  includeNegative: boolean;
  limit?: number;
}

interface ProviderAdapter {
  envNames: readonly string[];
  keyAliases: readonly string[];
  run(model: Model, params: JsonRecord, apiKey: string): Promise<ProviderResult>;
}

interface ProviderResult {
  ok: boolean;
  status: number;
  message: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_KEYS_FILE = path.resolve(REPO_ROOT, ".env.keys");
const REQUEST_TIMEOUT_MS = 45_000;

const PROVIDERS: Record<string, ProviderAdapter> = {
  anthropic: {
    envNames: ["ANTHROPIC_API_KEY"],
    keyAliases: ["anthropic"],
    run: runAnthropic,
  },
  deepseek: {
    envNames: ["DEEPSEEK_API_KEY"],
    keyAliases: ["deepseek"],
    run: (model, params, apiKey) =>
      runOpenAiCompatible("https://api.deepseek.com/chat/completions", model, params, apiKey, true),
  },
  gemini: {
    envNames: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    keyAliases: ["gemini", "google"],
    run: runGemini,
  },
  google: {
    envNames: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    keyAliases: ["gemini", "google"],
    run: runGemini,
  },
  groq: {
    envNames: ["GROQ_API_KEY"],
    keyAliases: ["groq"],
    run: (model, params, apiKey) =>
      runOpenAiCompatible(
        "https://api.groq.com/openai/v1/chat/completions",
        model,
        params,
        apiKey,
        true,
      ),
  },
  mistral: {
    envNames: ["MISTRAL_API_KEY"],
    keyAliases: ["mistral"],
    run: (model, params, apiKey) =>
      runOpenAiCompatible(
        "https://api.mistral.ai/v1/chat/completions",
        model,
        params,
        apiKey,
        true,
      ),
  },
  openai: {
    envNames: ["OPENAI_API_KEY"],
    keyAliases: ["openai"],
    run: (model, params, apiKey) =>
      runOpenAiCompatible(
        "https://api.openai.com/v1/chat/completions",
        model,
        params,
        apiKey,
        false,
      ),
  },
};

function parseOptions(argv: string[]): Options {
  const options: Options = {
    includeNegative: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const readValue = (): string => {
      const next = argv[i + 1];
      if (!next) throw new Error(`${arg} requires a value`);
      i += 1;
      return next;
    };

    if (arg === "--provider") options.provider = readValue().toLowerCase();
    else if (arg === "--model") options.model = readValue();
    else if (arg === "--auth-type") options.authType = readValue() as AuthType;
    else if (arg === "--keys-file") options.keysFile = path.resolve(readValue());
    else if (arg === "--positive-only") options.includeNegative = false;
    else if (arg === "--limit") options.limit = Number.parseInt(readValue(), 10);
    else if (arg === "--help" || arg === "-h") printHelpAndExit();
    else throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function printHelpAndExit(): never {
  console.log(`Usage: npm run smoke:params -- [options]

Options:
  --provider <provider>     Limit to one provider, e.g. anthropic
  --model <model>           Limit to one model id
  --auth-type <authType>    Limit to api_key or subscription
  --keys-file <path>        Free-form key file. Defaults to ./.env.keys when present
  --positive-only           Skip intentionally invalid applicability cases
  --limit <n>               Stop after n requests

The smoke test sends minimal live requests and never prints API keys or request bodies.`);
  process.exit(0);
}

async function loadKeys(keysFile?: string): Promise<Map<string, string>> {
  const keys = new Map<string, string>();
  for (const [provider, adapter] of Object.entries(PROVIDERS)) {
    for (const envName of adapter.envNames) {
      const value = process.env[envName];
      if (value) keys.set(provider, value);
    }
  }

  const file = keysFile ?? ((await exists(DEFAULT_KEYS_FILE)) ? DEFAULT_KEYS_FILE : undefined);
  if (!file) return keys;

  const text = await fs.readFile(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.toLowerCase() === "subscription") continue;

    for (const [provider, adapter] of Object.entries(PROVIDERS)) {
      if (keys.has(provider)) continue;
      if (!lineMatchesAnyAlias(trimmed, adapter.keyAliases)) continue;
      if (provider === "anthropic" && /\btoken\b/i.test(trimmed)) continue;

      const candidate = trimmed.split(/\s+/).at(-1);
      if (candidate && looksLikeApiKey(candidate)) {
        keys.set(provider, candidate);
      }
    }
  }

  return keys;
}

function lineMatchesAnyAlias(line: string, aliases: readonly string[]): boolean {
  const lower = line.toLowerCase();
  return aliases.some((alias) => lower.startsWith(alias.toLowerCase()));
}

function looksLikeApiKey(value: string): boolean {
  return value.length >= 12 && !value.includes("@");
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function buildCases(model: Model): SmokeCase[] {
  const cases: SmokeCase[] = [];
  for (const param of model.params) {
    for (const value of sampleValues(param)) {
      const params = applyValidContext(model, defaultParams(model));
      setPath(params, param.path, value);
      cases.push({
        name: `${param.path}=${formatValue(value)}`,
        params: applyValidContext(model, params),
        expected: "success",
      });
    }

    if (param.applicability) {
      cases.push(...buildNegativeApplicabilityCases(model, param));
    }
  }
  return dedupeCases(cases);
}

function sampleValues(param: Parameter): JsonValue[] {
  if (param.type === "boolean") return [true, false];
  if (param.type === "enum") return param.values as JsonValue[];
  if (param.type === "string") return param.default !== undefined ? [param.default] : ["test"];
  if (param.type === "integer" || param.type === "number") {
    const values: JsonValue[] = [];
    if (param.default !== undefined) values.push(param.default);
    if (param.range?.min !== undefined) values.push(param.range.min);
    if (param.range?.max !== undefined) values.push(param.range.max);
    return dedupeValues(values.length > 0 ? values : [1]);
  }
  return [];
}

function defaultParams(model: Model): JsonRecord {
  const params: JsonRecord = {};
  for (const param of model.params) {
    if (param.default === undefined) continue;
    if (!paramIsApplicable(param, params)) continue;
    setPath(params, param.path, param.default);
  }
  return params;
}

function applyValidContext(model: Model, input: JsonRecord): JsonRecord {
  const params = cloneRecord(input);
  let changed = true;
  while (changed) {
    changed = false;
    for (const param of model.params) {
      if (param.default === undefined || hasPath(params, param.path)) continue;
      if (!paramIsApplicable(param, params)) continue;
      setPath(params, param.path, param.default);
      changed = true;
    }
  }

  for (const param of model.params) {
    if (!hasPath(params, param.path)) continue;
    if (!paramIsApplicable(param, params)) deletePath(params, param.path);
  }

  ensureProviderMinimums(model, params);
  return params;
}

function ensureProviderMinimums(model: Model, params: JsonRecord): void {
  if (model.provider === "anthropic" && getPath(params, "thinking.type") === "enabled") {
    const budget = getPath(params, "thinking.budget_tokens");
    if (typeof budget === "number") {
      const maxTokens = getPath(params, "max_tokens");
      if (typeof maxTokens !== "number" || maxTokens <= budget) {
        setPath(params, "max_tokens", Math.ceil(budget) + 1);
      }
    }
  }
}

function buildNegativeApplicabilityCases(model: Model, param: Parameter): SmokeCase[] {
  const cases: SmokeCase[] = [];
  const value = sampleValues(param)[0];
  if (value === undefined) return cases;

  for (const params of inapplicableContexts(param)) {
    const next = applyValidContext(model, defaultParams(model));
    mergeRecord(next, params);
    setPath(next, param.path, value);
    ensureProviderMinimums(model, next);
    cases.push({
      name: `${param.path} forbidden with ${Object.keys(params).join("+")}`,
      params: next,
      expected: "failure",
    });
  }

  return cases;
}

function inapplicableContexts(param: Parameter): JsonRecord[] {
  const contexts: JsonRecord[] = [];
  const applicability = param.applicability;
  if (!applicability) return contexts;

  if (applicability.except) {
    for (const match of ruleList(applicability.except)) {
      contexts.push(matchContext(match, "match"));
    }
  }
  if (applicability.only) {
    for (const match of ruleList(applicability.only)) {
      contexts.push(matchContext(match, "miss"));
    }
  }

  return contexts;
}

function ruleList(rule: ApplicabilityRule | ApplicabilityRule[]): ApplicabilityRule[] {
  return Array.isArray(rule) ? rule : [rule];
}

function matchContext(rule: ApplicabilityRule, mode: "match" | "miss"): JsonRecord {
  const params: JsonRecord = {};
  for (const [pathKey, value] of Object.entries(rule)) {
    setPath(params, pathKey, mode === "match" ? matchingValue(value) : nonMatchingValue(value));
  }
  return params;
}

function matchingValue(value: ApplicabilityRule[string]): JsonValue {
  if (isRecord(value) && "not" in value) return nonMatchingValue(value.not);
  if (Array.isArray(value)) return value[0] as JsonValue;
  return value as JsonValue;
}

function nonMatchingValue(value: ApplicabilityRule[string]): JsonValue {
  if (isRecord(value) && "not" in value) return matchingValue(value.not);
  const blocked = new Set(Array.isArray(value) ? value : [value]);
  for (const candidate of ["disabled", "enabled", "adaptive", 0, 1, true, false, null]) {
    if (!blocked.has(candidate)) return candidate as JsonValue;
  }
  return "__mps_non_matching_value__";
}

function paramIsApplicable(param: Parameter, params: JsonRecord): boolean {
  const applicability = param.applicability;
  if (!applicability) return true;
  if (applicability.only && !ruleMatches(applicability.only, params)) return false;
  if (applicability.except && ruleMatches(applicability.except, params)) return false;
  return true;
}

function ruleMatches(rule: ApplicabilityRule | ApplicabilityRule[], params: JsonRecord): boolean {
  return ruleList(rule).some((match) =>
    Object.entries(match).every(([pathKey, expected]) =>
      valueMatches(getPath(params, pathKey), expected),
    ),
  );
}

function valueMatches(actual: unknown, expected: ApplicabilityRule[string]): boolean {
  if (actual === undefined) return false;
  if (isRecord(expected) && "not" in expected) return !valueMatches(actual, expected.not);
  if (Array.isArray(expected)) return expected.some((value) => jsonEqual(actual, value));
  return jsonEqual(actual, expected);
}

async function runAnthropic(
  model: Model,
  params: JsonRecord,
  apiKey: string,
): Promise<ProviderResult> {
  const body: JsonRecord = {
    model: model.model,
    max_tokens: 16,
    messages: [{ role: "user", content: "Reply with ok." }],
    ...params,
  };
  return postJson("https://api.anthropic.com/v1/messages", body, {
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
    "x-api-key": apiKey,
  });
}

async function runGemini(
  model: Model,
  params: JsonRecord,
  apiKey: string,
): Promise<ProviderResult> {
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model.model,
    )}:generateContent`,
  );
  url.searchParams.set("key", apiKey);
  const body: JsonRecord = {
    contents: [{ role: "user", parts: [{ text: "Reply with ok." }] }],
    generationConfig: params,
  };
  return postJson(url.toString(), body, {
    "content-type": "application/json",
  });
}

async function runOpenAiCompatible(
  endpoint: string,
  model: Model,
  params: JsonRecord,
  apiKey: string,
  addDefaultTokenCap: boolean,
): Promise<ProviderResult> {
  const body: JsonRecord = {
    model: model.model,
    messages: [{ role: "user", content: "Reply with ok." }],
    ...params,
  };
  if (
    addDefaultTokenCap &&
    getPath(params, "max_tokens") === undefined &&
    getPath(params, "max_completion_tokens") === undefined
  ) {
    body.max_tokens = 1;
  }
  return postJson(endpoint, body, {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  });
}

async function postJson(
  url: string,
  body: JsonRecord,
  headers: Record<string, string>,
): Promise<ProviderResult> {
  let last: ProviderResult | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    last = {
      ok: response.ok,
      status: response.status,
      message: summarizeProviderMessage(text),
    };
    if (!isTransientStatus(response.status)) return last;
    await delay(750 * (attempt + 1));
  }
  return last!;
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 529;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeProviderMessage(text: string): string {
  if (!text) return "";
  try {
    const parsed = JSON.parse(text) as unknown;
    if (isRecord(parsed)) {
      const error = parsed.error;
      if (isRecord(error)) {
        const message = error.message;
        if (typeof message === "string") return message.slice(0, 220);
      }
      const message = parsed.message;
      if (typeof message === "string") return message.slice(0, 220);
    }
  } catch {
    // Fall through to raw text summary.
  }
  return text.replace(/\s+/g, " ").slice(0, 220);
}

function dedupeCases(cases: SmokeCase[]): SmokeCase[] {
  const seen = new Set<string>();
  return cases.filter((testCase) => {
    const key = `${testCase.expected}:${testCase.name}:${JSON.stringify(testCase.params)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeValues(values: JsonValue[]): JsonValue[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = JSON.stringify(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasPath(record: JsonRecord, dottedPath: string): boolean {
  return getPath(record, dottedPath) !== undefined;
}

function getPath(record: JsonRecord, dottedPath: string): JsonValue | undefined {
  let current: unknown = record;
  for (const segment of dottedPath.split(".")) {
    if (!isRecord(current) || !(segment in current)) return undefined;
    current = current[segment];
  }
  return current as JsonValue;
}

function setPath(record: JsonRecord, dottedPath: string, value: JsonValue): void {
  const segments = dottedPath.split(".");
  let current = record;
  for (const segment of segments.slice(0, -1)) {
    const next = current[segment];
    if (!isRecord(next)) {
      current[segment] = {};
    }
    current = current[segment] as JsonRecord;
  }
  current[segments.at(-1)!] = value;
}

function deletePath(record: JsonRecord, dottedPath: string): void {
  const segments = dottedPath.split(".");
  let current: JsonRecord = record;
  for (const segment of segments.slice(0, -1)) {
    const next = current[segment];
    if (!isRecord(next)) return;
    current = next;
  }
  delete current[segments.at(-1)!];
}

function mergeRecord(target: JsonRecord, source: JsonRecord): void {
  for (const [key, value] of Object.entries(source)) {
    if (isRecord(value) && isRecord(target[key])) {
      mergeRecord(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

function cloneRecord(record: JsonRecord): JsonRecord {
  return structuredClone(record) as JsonRecord;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function formatValue(value: JsonValue): string {
  return JSON.stringify(value);
}

function modelMatches(model: Model, options: Options): boolean {
  if (options.provider && model.provider !== options.provider) return false;
  if (options.model && model.model !== options.model) return false;
  if (options.authType && model.authType !== options.authType) return false;
  return true;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const { models, issues } = await loadAllModels();
  if (issues.length > 0) {
    throw new Error(
      `Catalog has ${issues.length} validation issue(s). Run npm run validate first.`,
    );
  }

  const keys = await loadKeys(options.keysFile);
  const runnable = models.filter((model) => modelMatches(model, options));
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let sent = 0;

  for (const model of runnable) {
    const adapter = PROVIDERS[model.provider];
    const key = keys.get(model.provider);
    if (model.authType !== "api_key") {
      skipped += 1;
      console.log(`- ${model.provider}/${model.model} (${model.authType}) skipped: subscription`);
      continue;
    }
    if (!adapter) {
      skipped += 1;
      console.log(`- ${model.provider}/${model.model} skipped: no smoke adapter`);
      continue;
    }
    if (!key) {
      skipped += 1;
      console.log(`- ${model.provider}/${model.model} skipped: no API key`);
      continue;
    }

    const cases = buildCases(model).filter((testCase) =>
      options.includeNegative ? true : testCase.expected === "success",
    );
    for (const testCase of cases) {
      if (options.limit !== undefined && sent >= options.limit) break;
      sent += 1;
      const result = await adapter.run(model, testCase.params, key);
      const ok =
        testCase.expected === "success"
          ? result.ok
          : result.status === 400 || result.status === 422;
      if (ok) {
        passed += 1;
        const verb = testCase.expected === "success" ? "accepted" : "rejected";
        console.log(`✓ ${model.provider}/${model.model} ${testCase.name} ${verb}`);
      } else {
        failed += 1;
        console.log(
          `✗ ${model.provider}/${model.model} ${testCase.name} expected ${testCase.expected}, got ${result.status}: ${result.message}`,
        );
      }
    }
    if (options.limit !== undefined && sent >= options.limit) break;
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed, ${skipped} skipped, ${sent} sent.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(2);
});
