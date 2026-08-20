import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import { Model, modelId, type Model as ModelType } from "../schema/model.js";
import { MODELS_DIR } from "./paths.js";

export interface LoadIssue {
  file: string;
  message: string;
}

export interface LoadResult {
  models: ModelType[];
  issues: LoadIssue[];
}

async function walkYamlFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkYamlFiles(full);
      found.push(...nested);
    } else if (entry.isFile() && /\.(ya?ml)$/i.test(entry.name)) {
      found.push(full);
    }
  }
  return found.sort();
}

function formatZodIssue(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
}

function expectedIdFromPath(file: string, modelsDir: string): string {
  const rel = path.relative(modelsDir, file);
  const parts = rel.split(path.sep);
  if (parts.length < 2) return "";
  const provider = parts[0]!;
  const filename = parts
    .slice(1)
    .join("/")
    .replace(/\.(ya?ml)$/i, "");
  return `${provider}/${filename}`;
}

function validateOne(
  file: string,
  raw: unknown,
  modelsDir: string,
): { model?: ModelType; issue?: LoadIssue } {
  const parsed = Model.safeParse(raw);
  if (!parsed.success) {
    return { issue: { file, message: formatZodIssue(parsed.error) } };
  }
  const model = parsed.data;
  const expectedId = expectedIdFromPath(file, modelsDir);
  const derivedId = modelId(model);

  if (expectedId && derivedId !== expectedId) {
    const expectedFilename =
      model.authType === "api_key" ? `${model.model}.yaml` : `${model.model}-subscription.yaml`;
    return {
      issue: {
        file,
        message: `derived id "${derivedId}" does not match expected id "${expectedId}" from file path. Expected filename "${expectedFilename}".`,
      },
    };
  }
  return { model };
}

export async function loadAllModels(modelsDir: string = MODELS_DIR): Promise<LoadResult> {
  const files = await walkYamlFiles(modelsDir);
  const models: ModelType[] = [];
  const issues: LoadIssue[] = [];

  for (const file of files) {
    let raw: unknown;
    try {
      const text = await fs.readFile(file, "utf8");
      raw = yaml.load(text, { schema: yaml.JSON_SCHEMA });
    } catch (err) {
      issues.push({ file, message: `failed to parse YAML: ${(err as Error).message}` });
      continue;
    }

    const result = validateOne(file, raw, modelsDir);
    if (result.issue) {
      issues.push(result.issue);
      continue;
    }
    models.push(result.model!);
  }

  models.sort((a, b) => modelId(a).localeCompare(modelId(b)));
  return { models, issues };
}
