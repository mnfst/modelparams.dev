import { z } from "zod";

export const AuthType = z.enum(["api_key", "subscription"]);
export type AuthType = z.infer<typeof AuthType>;

export const ParameterType = z.enum(["boolean", "enum", "integer", "number", "string"]);
export type ParameterType = z.infer<typeof ParameterType>;

export const ParameterGroup = z.enum([
  "generation_length",
  "sampling",
  "reasoning",
  "tooling",
  "output_format",
  "observability",
  "provider_metadata",
]);
export type ParameterGroup = z.infer<typeof ParameterGroup>;

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const PARAM_PATH = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

export const Range = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
  })
  .refine((r) => r.min === undefined || r.max === undefined || r.max >= r.min, {
    message: "range.max must be >= range.min",
  });
export type Range = z.infer<typeof Range>;

export const JsonPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type JsonPrimitive = z.infer<typeof JsonPrimitive>;

const ApplicabilityValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([JsonPrimitive, z.array(JsonPrimitive), z.record(z.string(), ApplicabilityValue)]),
);

export const ApplicabilityRule = z.record(z.string(), ApplicabilityValue);
export type ApplicabilityRule = z.infer<typeof ApplicabilityRule>;

export const Applicability = z
  .object({
    only: z.union([ApplicabilityRule, z.array(ApplicabilityRule)]).optional(),
    except: z.union([ApplicabilityRule, z.array(ApplicabilityRule)]).optional(),
  })
  .refine((a) => a.only !== undefined || a.except !== undefined, {
    message: "applicability must define `only`, `except`, or both",
  });
export type Applicability = z.infer<typeof Applicability>;

const baseParameter = z.object({
  path: z
    .string()
    .min(1)
    .regex(PARAM_PATH, "param path must be snake_case dot-notation (e.g. `thinking.type`)"),
  label: z.string().min(1).max(80),
  description: z.string().min(1).max(500),
  group: ParameterGroup,
  applicability: Applicability.optional(),
});

export const BooleanParameter = baseParameter.extend({
  type: z.literal("boolean"),
  default: z.boolean().optional(),
});

export const IntegerParameter = baseParameter.extend({
  type: z.literal("integer"),
  default: z.number().int().optional(),
  range: Range.optional(),
});

export const NumberParameter = baseParameter.extend({
  type: z.literal("number"),
  default: z.number().optional(),
  range: Range.optional(),
});

export const StringParameter = baseParameter.extend({
  type: z.literal("string"),
  default: z.string().optional(),
});

export const EnumParameter = baseParameter.extend({
  type: z.literal("enum"),
  default: JsonPrimitive.optional(),
  values: z.array(JsonPrimitive).min(1),
});

export const Parameter = z.discriminatedUnion("type", [
  BooleanParameter,
  IntegerParameter,
  NumberParameter,
  StringParameter,
  EnumParameter,
]);
export type Parameter = z.infer<typeof Parameter>;

export const Model = z.object({
  provider: z.string().min(1).regex(SLUG, "provider must be a kebab-case slug (e.g. `anthropic`)"),
  authType: AuthType,
  model: z
    .string()
    .min(1)
    .regex(SLUG, "model must be a kebab-case slug (e.g. `claude-sonnet-4-6`)"),
  params: z.array(Parameter),
});
export type Model = z.infer<typeof Model>;

export const Catalog = z.object({
  $schema: z.string().url().optional(),
  generatedAt: z.string(),
  count: z.number().int().nonnegative(),
  models: z.array(Model),
});
export type Catalog = z.infer<typeof Catalog>;

export function authSuffix(authType: AuthType): "" | "-subscription" {
  return authType === "api_key" ? "" : "-subscription";
}

export function modelId(model: Pick<Model, "provider" | "model" | "authType">): string {
  return `${model.provider}/${model.model}${authSuffix(model.authType)}`;
}
