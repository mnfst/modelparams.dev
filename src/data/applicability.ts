import type { Applicability, ApplicabilityRule } from "../schema/model.js";

function formatPrimitive(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "string") return `"${v}"`;
  return String(v);
}

function formatValueSet(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 1) return formatPrimitive(value[0]);
    return `{${value.map(formatPrimitive).join(", ")}}`;
  }
  if (value !== null && typeof value === "object" && "not" in (value as Record<string, unknown>)) {
    return `≠ ${formatPrimitive((value as { not: unknown }).not)}`;
  }
  return formatPrimitive(value);
}

function formatRule(rule: ApplicabilityRule, joiner: " = " | " ∈ "): string[] {
  return Object.entries(rule).map(([path, value]) => {
    const set = formatValueSet(value);
    if (set.startsWith("≠")) return `${path} ${set}`;
    if (Array.isArray(value) && value.length > 1) return `${path}${joiner}${set}`;
    return `${path} = ${set}`;
  });
}

function toRuleArray(
  input: ApplicabilityRule | ApplicabilityRule[] | undefined,
): ApplicabilityRule[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

export interface ApplicabilityLines {
  only: string[];
  except: string[];
}

export function describeApplicability(
  applicability: Applicability | undefined,
): ApplicabilityLines {
  if (!applicability) return { only: [], except: [] };
  const only = toRuleArray(applicability.only).flatMap((r) => formatRule(r, " ∈ "));
  const except = toRuleArray(applicability.except).flatMap((r) => formatRule(r, " ∈ "));
  return { only, except };
}
