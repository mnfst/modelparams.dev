import { checkValue } from "./check-value.js";
import type { ModelId } from "./generated/model-ids.js";
import { getModel } from "./helpers.js";
import type {
  ApplicabilityCondition,
  ApplicabilityRule,
  ApplicabilityValue,
  JsonPrimitive,
  Param,
} from "./types.js";

/** A parameter that was supplied but isn't accepted alongside the other values in the request. */
export interface ApplicabilityIssue {
  /** Dot path of the parameter that doesn't apply. */
  readonly path: string;
  /** Human-readable cause, e.g. `top_p does not apply when temperature ≠ 1`. */
  readonly message: string;
  /** Dot paths of the parameters whose values caused the conflict. */
  readonly conflictsWith: readonly string[];
}

function toRules(
  input: ApplicabilityRule | readonly ApplicabilityRule[] | undefined,
): readonly ApplicabilityRule[] {
  if (!input) return [];
  return Array.isArray(input)
    ? (input as readonly ApplicabilityRule[])
    : [input as ApplicabilityRule];
}

function isCondition(value: ApplicabilityValue): value is ApplicabilityCondition {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "not" in value;
}

/**
 * Does the observed value satisfy one entry of a rule? An absent value never
 * satisfies a condition — we only report a conflict on positive evidence, so a
 * parameter the request never mentions and the model never defaults can't
 * trigger one.
 */
function conditionHolds(
  observed: JsonPrimitive | undefined,
  expected: ApplicabilityValue,
): boolean {
  if (observed === undefined) return false;
  if (isCondition(expected)) {
    const { not } = expected;
    return Array.isArray(not) ? !not.includes(observed) : observed !== not;
  }
  if (Array.isArray(expected)) return expected.includes(observed);
  return observed === expected;
}

function formatPrimitive(value: JsonPrimitive): string {
  return typeof value === "string" ? `"${value}"` : String(value);
}

function formatExpectation(path: string, expected: ApplicabilityValue): string {
  if (isCondition(expected)) {
    const { not } = expected;
    return Array.isArray(not)
      ? `${path} is not one of ${not.map(formatPrimitive).join(", ")}`
      : `${path} ≠ ${formatPrimitive(not as JsonPrimitive)}`;
  }
  if (Array.isArray(expected)) {
    return expected.length === 1
      ? `${path} = ${formatPrimitive(expected[0]!)}`
      : `${path} is one of ${expected.map(formatPrimitive).join(", ")}`;
  }
  return `${path} = ${formatPrimitive(expected as JsonPrimitive)}`;
}

function describeRule(rule: ApplicabilityRule): string {
  return Object.entries(rule)
    .map(([path, expected]) => formatExpectation(path, expected))
    .join(" and ");
}

/** Every key must hold for the rule to match. */
function ruleMatches(
  rule: ApplicabilityRule,
  resolve: (path: string) => JsonPrimitive | undefined,
): boolean {
  return Object.entries(rule).every(([path, expected]) => conditionHolds(resolve(path), expected));
}

function anyRuleMatches(
  rules: readonly ApplicabilityRule[],
  resolve: (path: string) => JsonPrimitive | undefined,
): ApplicabilityRule | undefined {
  return rules.find((rule) => ruleMatches(rule, resolve));
}

/**
 * Build the effective view of a request: what the provider will actually see.
 * An explicitly supplied value wins; otherwise the catalog default stands in,
 * because that is what the provider applies when the key is omitted.
 */
function effectiveValues(
  params: readonly Param[],
  supplied: Readonly<Record<string, unknown>>,
): (path: string) => JsonPrimitive | undefined {
  const defaults = new Map<string, JsonPrimitive>();
  for (const param of params) {
    if (param.default !== undefined) defaults.set(param.path, param.default);
  }
  return (path) => {
    if (Object.prototype.hasOwnProperty.call(supplied, path)) {
      return supplied[path] as JsonPrimitive;
    }
    return defaults.get(path);
  };
}

/**
 * Is `path` accepted for this model given the rest of the request?
 *
 * Returns `true` for parameters with no applicability rules, and for parameters
 * the model doesn't declare at all (that's `parseParams`' job to report, not
 * this one's).
 *
 * @example
 * isApplicable("anthropic/claude-3-opus-20240229", "top_p", { temperature: 0.5 });
 * // false — Anthropic rejects top_p unless temperature is 1
 */
export function isApplicable(
  id: ModelId,
  path: string,
  params: Readonly<Record<string, unknown>> = {},
): boolean {
  const all = getModel(id).params as readonly Param[];
  const param = all.find((p) => p.path === path);
  if (!param?.applicability) return true;
  const resolve = effectiveValues(all, params);
  const { only, except } = param.applicability;
  if (only && !anyRuleMatches(toRules(only), resolve)) return false;
  if (except && anyRuleMatches(toRules(except), resolve)) return false;
  return true;
}

/**
 * Report every supplied parameter that the model won't accept alongside the
 * others. This is the check that catches the errors a per-parameter validator
 * cannot see — `temperature and top_p cannot both be specified`, thinking-mode
 * knobs on a non-thinking request, and so on.
 *
 * Only parameters present in `params` are reported; unknown parameters are left
 * to {@link parseParams}.
 *
 * @example
 * checkApplicability("anthropic/claude-3-opus-20240229", { temperature: 0.5, top_p: 0.9 });
 * // [{ path: "top_p", message: "top_p does not apply when temperature ≠ 1", conflictsWith: ["temperature"] }]
 */
export function checkApplicability(
  id: ModelId,
  params: Readonly<Record<string, unknown>>,
): readonly ApplicabilityIssue[] {
  const all = getModel(id).params as readonly Param[];
  const resolve = effectiveValues(all, params);
  const issues: ApplicabilityIssue[] = [];

  for (const param of all) {
    if (!param.applicability) continue;
    if (!Object.prototype.hasOwnProperty.call(params, param.path)) continue;

    const { only, except } = param.applicability;

    const onlyRules = toRules(only);
    if (onlyRules.length > 0 && !anyRuleMatches(onlyRules, resolve)) {
      issues.push({
        path: param.path,
        message: `${param.path} only applies when ${onlyRules.map(describeRule).join(", or when ")}`,
        conflictsWith: [...new Set(onlyRules.flatMap((rule) => Object.keys(rule)))],
      });
      continue;
    }

    const matchedExcept = anyRuleMatches(toRules(except), resolve);
    if (matchedExcept) {
      issues.push({
        path: param.path,
        message: `${param.path} does not apply when ${describeRule(matchedExcept)}`,
        conflictsWith: Object.keys(matchedExcept),
      });
    }
  }

  return issues;
}

/** Why a parameter was removed: not in the catalog, bad value, or a conflict. */
export type DropCode = "unknown_parameter" | "invalid_value" | "not_applicable";

/** One parameter removed by {@link dropUnsupported}, with the reason why. */
export interface DroppedParam {
  readonly path: string;
  readonly value: unknown;
  readonly code: DropCode;
  readonly reason: string;
  /** For `not_applicable`: the parameters whose values caused the conflict. */
  readonly conflictsWith?: readonly string[];
}

/** The result of {@link dropUnsupported}: what's safe to send, and what was removed. */
export interface DropResult {
  readonly params: Record<string, JsonPrimitive>;
  readonly dropped: readonly DroppedParam[];
}

/**
 * Strip everything the model won't accept and return a params object that is
 * safe to spread into a provider call — the catalog-driven equivalent of
 * LiteLLM's `drop_params`, extended to conditional conflicts.
 *
 * Drops unknown parameters, values that fail their type/range/enum constraint,
 * and parameters that don't apply alongside the rest of the request.
 *
 * @example
 * const { params, dropped } = dropUnsupported("openai/gpt-5.5", {
 *   temperature: 0.7,      // dropped: gpt-5.5 exposes no temperature
 *   reasoning_effort: "low",
 * });
 * await openai.chat.completions.create({ model: "gpt-5.5", messages, ...params });
 */
export function dropUnsupported(id: ModelId, input: Readonly<Record<string, unknown>>): DropResult {
  const all = getModel(id).params as readonly Param[];
  const defs = new Map(all.map((param) => [param.path, param]));
  const dropped: DroppedParam[] = [];
  const kept: Record<string, JsonPrimitive> = {};

  for (const [path, value] of Object.entries(input)) {
    const def = defs.get(path);
    if (!def) {
      dropped.push({
        path,
        value,
        code: "unknown_parameter",
        reason: `${id} does not accept ${path}`,
      });
      continue;
    }
    const problem = checkValue(def, value);
    if (problem) {
      dropped.push({ path, value, code: "invalid_value", reason: `${path} ${problem}` });
      continue;
    }
    kept[path] = value as JsonPrimitive;
  }

  // Applicability is judged against the surviving request, then re-judged after
  // each removal: dropping one parameter can open a gate another parameter's
  // rule depended on. Each pass removes at least one key, so this terminates.
  for (;;) {
    const issues = checkApplicability(id, kept);
    if (issues.length === 0) break;
    for (const issue of issues) {
      dropped.push({
        path: issue.path,
        value: kept[issue.path],
        code: "not_applicable",
        reason: issue.message,
        conflictsWith: issue.conflictsWith,
      });
      delete kept[issue.path];
    }
  }

  return { params: kept, dropped };
}
