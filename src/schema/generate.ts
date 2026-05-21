import { zodToJsonSchema } from "zod-to-json-schema";
import { Model } from "./model.js";

const SCHEMA_ID = "https://modelparams.dev/api/v1/schema.json";

export function buildModelJsonSchema(): Record<string, unknown> {
  const generated = zodToJsonSchema(Model, {
    name: "Model",
    target: "jsonSchema7",
  }) as Record<string, unknown>;

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: SCHEMA_ID,
    title: "modelparams.dev Model",
    description: "Schema for a single AI model variant entry in the modelparams.dev catalog.",
    ...generated,
  };
}
