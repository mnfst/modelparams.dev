import { loadAllModels } from "./load.js";

async function main(): Promise<void> {
  const { models, issues } = await loadAllModels();

  if (issues.length > 0) {
    console.error(`Found ${issues.length} validation issue(s):\n`);
    for (const issue of issues) {
      console.error(`  • ${issue.file}`);
      console.error(`    ${issue.message}\n`);
    }
    process.exit(1);
  }

  console.log(`OK — validated ${models.length} model(s).`);
}

main().catch((err) => {
  console.error("Validation crashed:", err);
  process.exit(2);
});
