import fs from "node:fs/promises";
import path from "node:path";
import {
  buildCapabilityFacets,
  buildCatalog,
  buildProviderFacets,
} from "../data/catalog.js";
import { loadAllModels } from "../data/load.js";
import {
  DIST_API_DIR,
  DIST_ASSETS_DIR,
  DIST_DIR,
  MODELS_DIR,
} from "../data/paths.js";
import { modelId } from "../schema/model.js";
import { buildModelJsonSchema } from "../schema/generate.js";
import { bundleClientScript, compileStyles, copyStaticAssets } from "./assets.js";
import { renderIndex } from "./render.js";

const SITE_URL = process.env.SITE_URL ?? "https://modelparams.dev";

async function cleanDist(): Promise<void> {
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(DIST_ASSETS_DIR, { recursive: true });
  await fs.mkdir(path.join(DIST_API_DIR, "models"), { recursive: true });
}

async function writeJson(file: string, payload: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

async function writeRobotsAndSitemap(): Promise<void> {
  const robots = `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  await fs.writeFile(path.join(DIST_DIR, "robots.txt"), robots, "utf8");

  const today = new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>
  <url><loc>${SITE_URL}/api/v1/models.json</loc><lastmod>${today}</lastmod><priority>0.5</priority></url>
</urlset>
`;
  await fs.writeFile(path.join(DIST_DIR, "sitemap.xml"), sitemap, "utf8");
}

async function writeApiIndex(modelCount: number): Promise<void> {
  const body = {
    name: "modelparams.dev API",
    version: "v1",
    endpoints: {
      catalog: "/api/v1/models.json",
      schema: "/api/v1/schema.json",
      modelByIdApiKey: "/api/v1/models/{provider}/{model}.json",
      modelByIdSubscription: "/api/v1/models/{provider}/{model}-subscription.json",
    },
    modelCount,
    docs: "https://github.com/modelparameters/modelparameters.dev#api",
  };
  await writeJson(path.join(DIST_API_DIR, "index.json"), body);
}

export async function build(): Promise<{ models: number }> {
  const startedAt = Date.now();
  console.log(`Loading models from ${path.relative(process.cwd(), MODELS_DIR)}...`);

  const { models, issues } = await loadAllModels();
  if (issues.length > 0) {
    console.error(`Aborting build — ${issues.length} validation issue(s):`);
    for (const issue of issues) {
      console.error(`  ${issue.file}\n    ${issue.message}`);
    }
    throw new Error("Validation failed");
  }

  await cleanDist();

  const catalog = buildCatalog(models);
  const capabilities = buildCapabilityFacets(models);
  const providers = buildProviderFacets(models);

  console.log(`Rendering HTML for ${models.length} model(s)...`);
  const html = await renderIndex({ catalog, capabilities, providers });
  await fs.writeFile(path.join(DIST_DIR, "index.html"), html, "utf8");

  console.log("Writing JSON API...");
  await writeJson(path.join(DIST_API_DIR, "models.json"), catalog);
  await writeJson(path.join(DIST_API_DIR, "schema.json"), buildModelJsonSchema());
  await writeApiIndex(catalog.count);
  for (const model of models) {
    const [provider, slug] = modelId(model).split("/");
    if (!provider || !slug) continue;
    await writeJson(path.join(DIST_API_DIR, "models", provider, `${slug}.json`), {
      $schema: "https://modelparams.dev/api/v1/schema.json",
      ...model,
    });
  }

  console.log("Bundling client + styles...");
  await Promise.all([bundleClientScript(), compileStyles(), copyStaticAssets()]);

  await writeRobotsAndSitemap();

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);
  console.log(`Built ${models.length} models in ${elapsed}s.`);
  return { models: models.length };
}

const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  build().catch((err) => {
    console.error("Build failed:", err);
    process.exit(1);
  });
}
