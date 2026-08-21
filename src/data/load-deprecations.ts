import { readFile } from "node:fs/promises";
import yaml from "js-yaml";
import { Deprecation, type Deprecation as DeprecationType } from "../schema/deprecation.js";
import { modelId } from "../schema/model.js";
import { expectedIdFromPath, formatZodIssue, walkYamlFiles, type LoadIssue } from "./load.js";
import { DEPRECATIONS_DIR } from "./paths.js";

export interface LoadDeprecationsResult {
  deprecations: DeprecationType[];
  issues: LoadIssue[];
}

function validateOne(
  file: string,
  raw: unknown,
  dir: string,
): { deprecation?: DeprecationType; issue?: LoadIssue } {
  const parsed = Deprecation.safeParse(raw);
  if (!parsed.success) {
    return { issue: { file, message: formatZodIssue(parsed.error) } };
  }
  const deprecation = parsed.data;
  const expectedId = expectedIdFromPath(file, dir);
  const derivedId = modelId(deprecation);

  if (expectedId && derivedId !== expectedId) {
    return {
      issue: {
        file,
        message: `derived id "${derivedId}" does not match expected id "${expectedId}" from file path.`,
      },
    };
  }
  return { deprecation };
}

export async function loadAllDeprecations(
  dir: string = DEPRECATIONS_DIR,
): Promise<LoadDeprecationsResult> {
  const files = await walkYamlFiles(dir);
  const deprecations: DeprecationType[] = [];
  const issues: LoadIssue[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    let raw: unknown;
    try {
      const text = await readFile(file, "utf8");
      raw = yaml.load(text, { schema: yaml.JSON_SCHEMA });
    } catch (err) {
      issues.push({ file, message: `failed to parse YAML: ${(err as Error).message}` });
      continue;
    }

    const result = validateOne(file, raw, dir);
    if (result.issue) {
      issues.push(result.issue);
      continue;
    }

    const id = modelId(result.deprecation!);
    if (seen.has(id)) {
      issues.push({ file, message: `duplicate deprecation entry for model id "${id}"` });
      continue;
    }
    seen.add(id);
    deprecations.push(result.deprecation!);
  }

  deprecations.sort((a, b) => modelId(a).localeCompare(modelId(b)));
  return { deprecations, issues };
}
