import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The fields we import from modeldeprecations.dev for each model.
 *
 * `status` is always present. `replacement` and `shutdownOn` are omitted when
 * the deprecations source does not publish them, and their absence also clears
 * any previously-synced value (the source of truth wins, stale data is dropped).
 */
export interface LifecycleRecord {
  provider: string;
  model: string;
  status: "active" | "deprecated" | "retired";
  replacement?: string;
  shutdownOn?: string;
}

const ReplacementSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  recommended: z.boolean().optional(),
});

const DeprecationEntrySchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  status: z.enum(["active", "deprecated", "retired"]),
  shutdown_on: z.string().regex(ISO_DATE).nullable().optional(),
  replacements: z.array(ReplacementSchema).optional(),
});

function describeZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
}

export type LifecycleParseResult =
  | { ok: true; record: LifecycleRecord }
  | { ok: false; reason: string };

export function parseLifecycleRecord(entry: unknown): LifecycleParseResult {
  const parsed = DeprecationEntrySchema.safeParse(entry);
  if (!parsed.success) {
    return { ok: false, reason: describeZodError(parsed.error) };
  }

  const { provider, model, status, shutdown_on, replacements } = parsed.data;
  const recommended =
    replacements?.find((replacement) => replacement.recommended) ?? replacements?.[0];

  return {
    ok: true,
    record: {
      provider,
      model,
      status,
      replacement: recommended ? `${recommended.provider}/${recommended.model}` : undefined,
      shutdownOn: shutdown_on ?? undefined,
    },
  };
}

export function toLifecycleRecord(entry: unknown): LifecycleRecord | undefined {
  const result = parseLifecycleRecord(entry);
  return result.ok ? result.record : undefined;
}

export function keyOf(provider: string, model: string): string {
  return `${provider}/${model}`;
}

export interface RejectedEntry {
  entry: unknown;
  reason: string;
}

export interface IndexResult {
  index: Map<string, LifecycleRecord>;
  rejected: RejectedEntry[];
}

export function indexDeprecations(models: unknown): IndexResult {
  if (!Array.isArray(models)) {
    throw new Error("deprecations payload `models` must be an array");
  }
  const index = new Map<string, LifecycleRecord>();
  const rejected: RejectedEntry[] = [];
  for (const entry of models) {
    const result = parseLifecycleRecord(entry);
    if (result.ok) {
      index.set(keyOf(result.record.provider, result.record.model), result.record);
    } else {
      rejected.push({ entry, reason: result.reason });
    }
  }
  return { index, rejected };
}

const LIFECYCLE_KEYS = /^(status|replacement|shutdownOn):/;

function blockFor(record: LifecycleRecord): string[] {
  const block: string[] = [`status: ${record.status}`];
  if (record.replacement) block.push(`replacement: ${record.replacement}`);
  if (record.shutdownOn) block.push(`shutdownOn: ${record.shutdownOn}`);
  return block;
}

/**
 * Rewrites the top-level lifecycle block of a model YAML to match `record`,
 * preserving every other line (including comments and block scalars).
 *
 * The block is kept immediately after the top-level `model:` line, mirroring the
 * ordering produced by the original lifecycle import.
 */
export function applyLifecycle(text: string, record: LifecycleRecord): string {
  const lines = text.split("\n");
  const modelIndex = lines.findIndex((line) => /^model:\s+\S+/.test(line));
  if (modelIndex === -1) return text;

  const kept = lines.filter((line) => !LIFECYCLE_KEYS.test(line));
  const keptModelIndex = kept.findIndex((line) => /^model:\s+\S+/.test(line));
  if (keptModelIndex === -1) return text;

  kept.splice(keptModelIndex + 1, 0, ...blockFor(record));
  return kept.join("\n");
}
