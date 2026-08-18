import type { ModelId } from "./generated/model-ids.js";
import type { ParamsById } from "./generated/params-by-id.js";

/**
 * Parameters a builder can pass when calling a given model. Every key is
 * optional — set the ones you want to override and let the SDK or provider
 * apply its own default for the rest.
 *
 * Compile-time errors on unknown keys and invalid enum values.
 *
 * @example
 * import type { ParamsOf } from "modelparams";
 * const params: ParamsOf<"anthropic/claude-haiku-4-5-20251001"> = {
 *   max_tokens: 4096,
 *   "thinking.type": "enabled",
 * };
 */
export type ParamsOf<Id extends ModelId> = Partial<ParamsById[Id]>;

/**
 * Fully-specified parameter shape for a given model id. Every catalog-declared
 * parameter is required. Useful when round-tripping defaults + overrides
 * through the type system.
 */
export type StrictParamsOf<Id extends ModelId> = ParamsById[Id];

/** A JSON-primitive parameter value. */
export type JsonPrimitive = string | number | boolean | null;

/** The kind of a parameter's value. */
export type ParamType = "boolean" | "enum" | "integer" | "number" | "string";

/** The semantic group a parameter belongs to (drives grouped settings UIs). */
export type ParamGroup =
  | "generation_length"
  | "sampling"
  | "reasoning"
  | "tooling"
  | "output_format"
  | "observability"
  | "provider_metadata";

/** Numeric bounds for an `integer` / `number` parameter. */
export interface ParamRange {
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

/** Negated match: the referenced parameter must not equal (or be among) `not`. */
export interface ApplicabilityCondition {
  readonly not: JsonPrimitive | readonly JsonPrimitive[];
}

/**
 * What another parameter must be for a rule to match: an exact value, one of a
 * set of values, or anything but a value (`{ not: ... }`).
 */
export type ApplicabilityValue = JsonPrimitive | readonly JsonPrimitive[] | ApplicabilityCondition;

/**
 * One condition set, keyed by the dot path of the parameter it constrains.
 * Every entry must hold for the rule to match (AND).
 */
export type ApplicabilityRule = { readonly [path: string]: ApplicabilityValue };

/**
 * When a parameter is accepted, expressed in terms of the other parameters in
 * the same request. A list of rules matches if any one of them matches (OR).
 *
 * `only` — the parameter applies *only* while a rule matches.
 * `except` — the parameter does *not* apply while a rule matches.
 */
export interface Applicability {
  readonly only?: ApplicabilityRule | readonly ApplicabilityRule[];
  readonly except?: ApplicabilityRule | readonly ApplicabilityRule[];
}

/** Present when the provider stopped honoring the param for this model id. */
export interface ParamDeprecation {
  readonly behavior: "rejected" | "ignored" | "default-only";
  readonly since?: string;
  readonly note?: string;
}

/**
 * A single parameter definition in a loose, easy-to-iterate shape — the runtime
 * counterpart to the precise per-model `ParamsOf<Id>` types.
 *
 * The precise `getModel(id).params` / `getParam(...)` values assign to `Param`
 * without a cast, so you can annotate a loop variable as `Param` and read
 * `range` / `values` uniformly instead of narrowing a deep `as const` union.
 *
 * @example
 * import { getModel, type Param } from "modelparams";
 * const params: readonly Param[] = getModel("openai/gpt-4.1").params;
 * for (const p of params) renderControl(p.path, p.type, p.range, p.values);
 */
export interface Param {
  readonly path: string;
  readonly label: string;
  readonly description: string;
  readonly group: ParamGroup;
  readonly type: ParamType;
  readonly default?: JsonPrimitive;
  /** Present on `integer` / `number` params. */
  readonly range?: ParamRange;
  /** Present on `enum` params. */
  readonly values?: readonly JsonPrimitive[];
  /** When set, the parameter is only accepted for some values of its siblings. */
  readonly applicability?: Applicability;
  /** Present when the provider deprecated the param for this model. */
  readonly deprecated?: ParamDeprecation;
}
