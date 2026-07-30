import type { JsonPrimitive, Param } from "./types.js";

/**
 * Validate one value against a single parameter definition — type, numeric
 * range, and enum membership. Returns an error message, or null if the value is
 * acceptable in isolation.
 *
 * Cross-parameter conflicts are not this function's concern; see
 * `checkApplicability`.
 */
export function checkValue(def: Param, value: unknown): string | null {
  if (def.type === "boolean") {
    return typeof value === "boolean" ? null : "must be a boolean";
  }
  if (def.type === "string") {
    return typeof value === "string" ? null : "must be a string";
  }
  if (def.type === "enum") {
    const values = def.values ?? [];
    if (values.includes(value as JsonPrimitive)) return null;
    return `must be one of ${values.map((v) => JSON.stringify(v)).join(", ")}`;
  }
  // "integer" | "number"
  if (typeof value !== "number" || Number.isNaN(value)) return "must be a number";
  if (def.type === "integer" && !Number.isInteger(value)) return "must be an integer";
  const { min, max } = def.range ?? {};
  if (min !== undefined && value < min) return `must be >= ${min}`;
  if (max !== undefined && value > max) return `must be <= ${max}`;
  return null;
}
