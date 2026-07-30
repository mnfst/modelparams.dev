import { checkApplicability } from "./applicability.js";
import { checkValue } from "./check-value.js";
import type { ModelId } from "./generated/model-ids.js";
import { getModel } from "./helpers.js";
import type { JsonPrimitive, Param } from "./types.js";
import type { StandardSchemaV1 } from "./standard-schema.js";

/** A single problem found while validating a params object. */
export interface ParamIssue {
  readonly message: string;
  /** Location of the problem: `[]` for the whole object, `[key]` for one param. */
  readonly path: readonly PropertyKey[];
}

/** The result of {@link parseParams}: validated params, or the issues found. */
export type ParseParamsResult =
  | { readonly success: true; readonly value: Record<string, JsonPrimitive> }
  | { readonly success: false; readonly issues: readonly ParamIssue[] };

/**
 * Validate an untrusted params object (e.g. an HTTP request body) against a
 * model's catalog. Unknown keys, wrong types, out-of-range numbers and invalid
 * enum values are reported. This is the runtime complement to `ParamsOf<Id>`,
 * which only constrains params known at compile time.
 *
 * Cross-parameter `applicability` rules are enforced too, so combinations the
 * provider rejects at runtime — `temperature` alongside a thinking budget, say —
 * surface here rather than as a 400 from the provider. Every parameter is
 * checked in isolation first; conflicts are only reported once each value is
 * individually valid.
 *
 * @example
 * const result = parseParams("openai/gpt-4.1", req.body.params);
 * if (!result.success) return res.status(422).json({ issues: result.issues });
 * await openai.chat.completions.create({ model: "gpt-4.1", messages, ...result.value });
 */
export function parseParams(id: ModelId, input: unknown): ParseParamsResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { success: false, issues: [{ message: "params must be an object", path: [] }] };
  }

  const defs = new Map<string, Param>();
  for (const param of getModel(id).params) defs.set(param.path, param);

  const issues: ParamIssue[] = [];
  const value: Record<string, JsonPrimitive> = {};

  for (const [key, raw] of Object.entries(input)) {
    const def = defs.get(key);
    if (!def) {
      const allowed = [...defs.keys()].join(", ") || "(none)";
      issues.push({ message: `unknown parameter for ${id}; allowed: ${allowed}`, path: [key] });
      continue;
    }
    const problem = checkValue(def, raw);
    if (problem) {
      issues.push({ message: `"${key}" ${problem}`, path: [key] });
      continue;
    }
    value[key] = raw as JsonPrimitive;
  }

  if (issues.length > 0) return { success: false, issues };

  // Only worth asking once every value is individually sound — an out-of-range
  // temperature would otherwise produce a confusing conflict report on top of
  // the range error.
  const conflicts = checkApplicability(id, value);
  if (conflicts.length > 0) {
    return {
      success: false,
      issues: conflicts.map((conflict) => ({
        message: conflict.message,
        path: [conflict.path],
      })),
    };
  }

  return { success: true, value };
}

/**
 * A Standard Schema (https://standardschema.dev) that validates a params object
 * for `id`. Plugs into any Standard-Schema-aware library (tRPC, Hono, …).
 *
 * @example
 * import { paramsSchema } from "modelparams";
 * app.post("/chat", validator("json", paramsSchema("openai/gpt-4.1")), handler);
 */
export function paramsSchema(
  id: ModelId,
): StandardSchemaV1<unknown, Record<string, JsonPrimitive>> {
  return {
    "~standard": {
      version: 1,
      vendor: "modelparams",
      validate: (input) => {
        const result = parseParams(id, input);
        return result.success ? { value: result.value } : { issues: result.issues };
      },
    },
  };
}
