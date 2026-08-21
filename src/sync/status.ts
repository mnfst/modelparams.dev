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

export function toLifecycleRecord(entry: unknown): LifecycleRecord | undefined {
  const parsed = DeprecationEntrySchema.safeParse(entry);
  if (!parsed.success) return undefined;

  const { provider, model, status, shutdown_on, replacements } = parsed.data;
  const recommended =
    replacements?.find((replacement) => replacement.recommended) ?? replacements?.[0];

  return {
    provider,
    model,
    status,
    replacement: recommended ? `${recommended.provider}/${recommended.model}` : undefined,
    shutdownOn: shutdown_on ?? undefined,
  };
}

export function keyOf(provider: string, model: string): string {
  return `${provider}/${model}`;
}

export function indexDeprecations(models: unknown): Map<string, LifecycleRecord> {
  if (!Array.isArray(models)) {
    throw new Error("deprecations payload `models` must be an array");
  }
  const index = new Map<string, LifecycleRecord>();
  for (const entry of models) {
    const record = toLifecycleRecord(entry);
    if (record) index.set(keyOf(record.provider, record.model), record);
  }
  return index;
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
  const kept = text.split("\n").filter((line) => !LIFECYCLE_KEYS.test(line));

  // Anchor after the wireId when present, else after the model id, so the
  // lifecycle block stays at the top of the file in canonical field order.
  const anchorIndex = kept.findIndex((line) => /^wireId:\s+\S+/.test(line));
  const modelIndex = kept.findIndex((line) => /^model:\s+\S+/.test(line));
  const insertIndex = anchorIndex !== -1 ? anchorIndex : modelIndex;
  if (insertIndex === -1) return text;

  kept.splice(insertIndex + 1, 0, ...blockFor(record));
  return kept.join("\n");
}
