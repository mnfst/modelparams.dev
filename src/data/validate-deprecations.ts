import { loadAllModels } from "./load.js";
import { loadAllDeprecations } from "./load-deprecations.js";
import { modelId } from "../schema/model.js";

async function main(): Promise<void> {
  const [{ models }, { deprecations, issues: loadIssues }] = await Promise.all([
    loadAllModels(),
    loadAllDeprecations(),
  ]);

  const errors: string[] = loadIssues.map((i) => `${i.file}: ${i.message}`);

  const activeIds = new Set(models.map((m) => modelId(m)));
  const deprecatedIds = new Set(deprecations.map((d) => modelId(d)));

  for (const entry of deprecations) {
    const id = modelId(entry);

    if (!activeIds.has(id)) {
      errors.push(`${id}: deprecation entry for a model that is not in the catalog`);
    }

    if (entry.replacement !== undefined) {
      if (!activeIds.has(entry.replacement)) {
        errors.push(`${id}: replacement "${entry.replacement}" is not in the catalog`);
      } else if (deprecatedIds.has(entry.replacement)) {
        errors.push(`${id}: replacement "${entry.replacement}" is itself deprecated`);
      }
    }
  }

  if (errors.length > 0) {
    console.error(`Found ${errors.length} deprecation validation issue(s):\n`);
    for (const error of errors) {
      console.error(`  • ${error}`);
    }
    console.error("");
    process.exit(1);
  }

  console.log(
    `OK — validated ${deprecations.length} deprecation(s) against ${models.length} model(s).`,
  );
}

main().catch((err) => {
  console.error("Deprecation validation crashed:", err);
  process.exit(2);
});
