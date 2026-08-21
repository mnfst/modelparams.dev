import { z } from "zod";
import { AuthType, MODEL_ID, PROVIDER_SLUG, modelId } from "./model.js";

export const DeprecationStatus = z.enum(["deprecated", "sunset", "removed"]);
export type DeprecationStatus = z.infer<typeof DeprecationStatus>;

export const DeprecationReason = z.enum(["superseded", "retired", "renamed", "removed"]);
export type DeprecationReason = z.infer<typeof DeprecationReason>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const Deprecation = z
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
    status: DeprecationStatus,
    deprecatedAt: z.string().regex(ISO_DATE, "deprecatedAt must be an ISO date (YYYY-MM-DD)"),
    sunsetAt: z.string().regex(ISO_DATE, "sunsetAt must be an ISO date (YYYY-MM-DD)").optional(),
    replacement: z.string().min(1).optional(),
    reason: DeprecationReason,
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (entry.status !== "deprecated" && entry.sunsetAt === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sunsetAt"],
        message: `sunsetAt is required when status is "${entry.status}"`,
      });
    }
    if (entry.sunsetAt !== undefined && entry.sunsetAt < entry.deprecatedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sunsetAt"],
        message: "sunsetAt must be on or after deprecatedAt",
      });
    }
    if (entry.replacement !== undefined && entry.replacement === modelId(entry)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["replacement"],
        message: "replacement must not be the same model",
      });
    }
  });
export type Deprecation = z.infer<typeof Deprecation>;
