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

const PROVIDER_SLUG = /^[a-z0-9][a-z0-9-]*$/;
const MODEL_ID = /^[a-z0-9][a-z0-9._:-]*$/;
const PARAM_PATH = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;
const BLOCKED_PARAM_PATHS = new Set(["stream"]);

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

const JsonPrimitiveArray = z.array(JsonPrimitive).min(1);

const ApplicabilityCondition = z
  .object({
    not: z.union([JsonPrimitive, JsonPrimitiveArray]),
  })
  .strict();

const ApplicabilityValue = z.union([JsonPrimitive, JsonPrimitiveArray, ApplicabilityCondition]);

export const ApplicabilityRule = z
  .record(
    z.string().regex(PARAM_PATH, "applicability keys must be snake_case dot paths"),
    ApplicabilityValue,
  )
  .refine((rule) => Object.keys(rule).length > 0, {
    message: "applicability rule must contain at least one condition",
  });
export type ApplicabilityRule = z.infer<typeof ApplicabilityRule>;

const ApplicabilityRuleList = z.array(ApplicabilityRule).min(1);

export const Applicability = z
  .object({
    only: z.union([ApplicabilityRule, ApplicabilityRuleList]).optional(),
    except: z.union([ApplicabilityRule, ApplicabilityRuleList]).optional(),
  })
  .strict()
  .refine((a) => a.only !== undefined || a.except !== undefined, {
    message: "applicability must define `only`, `except`, or both",
  });
export type Applicability = z.infer<typeof Applicability>;

const baseParameterShape = {
  path: z
    .string()
    .min(1)
    .regex(PARAM_PATH, "param path must be snake_case dot-notation (e.g. `thinking.type`)"),
  label: z.string().min(1).max(80),
  description: z.string().min(1).max(500),
  group: ParameterGroup,
  applicability: Applicability.optional(),
};

export const BooleanParameter = z
  .object({
    ...baseParameterShape,
    type: z.literal("boolean"),
    default: z.boolean().optional(),
  })
  .strict();

export const IntegerParameter = z
  .object({
    ...baseParameterShape,
    type: z.literal("integer"),
    default: z.number().int().optional(),
    range: Range.optional(),
  })
  .strict();

export const NumberParameter = z
  .object({
    ...baseParameterShape,
    type: z.literal("number"),
    default: z.number().optional(),
    range: Range.optional(),
  })
  .strict();

export const StringParameter = z
  .object({
    ...baseParameterShape,
    type: z.literal("string"),
    default: z.string().optional(),
  })
  .strict();

export const EnumParameter = z
  .object({
    ...baseParameterShape,
    type: z.literal("enum"),
    default: JsonPrimitive.optional(),
    values: z.array(JsonPrimitive).min(1),
  })
  .strict();

export const Parameter = z
  .discriminatedUnion("type", [
    BooleanParameter,
    EnumParameter,
    IntegerParameter,
    NumberParameter,
    StringParameter,
  ])
  .superRefine((parameter, ctx) => {
    if (BLOCKED_PARAM_PATHS.has(parameter.path)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["path"],
        message: `${parameter.path} is an API-level capability, not an MPS parameter`,
      });
    }

    if (
      parameter.type === "enum" &&
      parameter.default !== undefined &&
      !parameter.values.some((value) => value === parameter.default)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["default"],
        message: "enum default must be one of values",
      });
    }
  });
export type Parameter = z.infer<typeof Parameter>;

export const Model = z
  .object({
    provider: z
      .string()
      .min(1)
      .regex(PROVIDER_SLUG, "provider must be a kebab-case slug (e.g. `anthropic`)"),
    authType: AuthType,
    model: z
      .string()
      .min(1)
      .regex(MODEL_ID, "model must be a provider-native model id without path separators"),
    params: z.array(Parameter),
  })
  .strict();
export type Model = z.infer<typeof Model>;

export const Catalog = z
  .object({
    $schema: z.string().url().optional(),
    generatedAt: z.string(),
    count: z.number().int().nonnegative(),
    models: z.array(Model),
  })
  .strict();
export type Catalog = z.infer<typeof Catalog>;

export function authPathSegment(authType: AuthType): "api" | "subscription" {
  return authType === "api_key" ? "api" : "subscription";
}

export function authTypeFromPathSegment(segment: string): AuthType | null {
  if (segment === "api") return "api_key";
  if (segment === "subscription") return "subscription";
  return null;
}

export function modelId(model: Pick<Model, "provider" | "model" | "authType">): string {
  return `${model.provider}/${authPathSegment(model.authType)}/${model.model}`;
}
