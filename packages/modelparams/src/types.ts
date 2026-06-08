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
