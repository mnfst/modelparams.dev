import fs from "node:fs/promises";
import path from "node:path";
import {
  buildCapabilityFacets,
  buildCatalog,
  buildProviderFacets,
  uniqueProviders,
} from "../data/catalog.js";
import { loadAllModels } from "../data/load.js";
import { buildLlmsFullTxt, buildLlmsTxt } from "../data/llms.js";
import { listModelParamsResponses } from "../data/model-params.js";
import {
  DIST_API_DIR,
  DIST_ASSETS_DIR,
  DIST_DIR,
  MODELS_DIR,
} from "../data/paths.js";
import { SITE_URL } from "../data/site.js";
import { GLOSSARY_PATH, modelPagePath, providerPagePath } from "../data/urls.js";
import { modelId, type Model } from "../schema/model.js";
import { buildModelJsonSchema } from "../schema/generate.js";
import { bundleClientScript, compileStyles, copyStaticAssets } from "./assets.js";
import { renderIndex } from "./render.js";
import { renderGlossaryPage } from "./render-glossary.js";
import { renderModelPage } from "./render-model.js";
import { renderProviderPage } from "./render-provider.js";

async function cleanDist(): Promise<void> {
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(DIST_ASSETS_DIR, { recursive: true });
  await fs.mkdir(path.join(DIST_API_DIR, "models"), { recursive: true });
  await fs.mkdir(path.join(DIST_API_DIR, "params"), { recursive: true });
}

async function writeJson(file: string, payload: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

async function writeLlmsFiles(models: Model[]): Promise<void> {
  await fs.writeFile(path.join(DIST_DIR, "llms.txt"), buildLlmsTxt(SITE_URL, models), "utf8");
  await fs.writeFile(
    path.join(DIST_DIR, "llms-full.txt"),
    buildLlmsFullTxt(SITE_URL, models),
    "utf8",
  );
}

async function writeRobotsAndSitemap(models: Model[]): Promise<void> {
  const robots = `# AI agents welcome. Machine-readable overview: ${SITE_URL}/llms.txt\nUser-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  await fs.writeFile(path.join(DIST_DIR, "robots.txt"), robots, "utf8");

  // Sitemaps list canonical, indexable HTML pages only — the JSON API and the
  // .txt agent files are intentionally excluded (they're not search results).
  const today = new Date().toISOString().slice(0, 10);
  const entries: { path: string; priority: string }[] = [
    { path: "/", priority: "1.0" },
    { path: GLOSSARY_PATH, priority: "0.7" },
    ...uniqueProviders(models).map((provider) => ({
      path: providerPagePath(provider),
      priority: "0.8",
    })),
    ...models.map((model) => ({ path: modelPagePath(model), priority: "0.6" })),
  ];
  const body = entries
    .map(
      ({ path: loc, priority }) =>
        `  <url><loc>${SITE_URL}${loc}</loc><lastmod>${today}</lastmod><priority>${priority}</priority></url>`,
    )
    .join("\n");
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
  await fs.writeFile(path.join(DIST_DIR, "sitemap.xml"), sitemap, "utf8");
}

async function writeHtmlPages(models: Model[]): Promise<void> {
  for (const model of models) {
    const [provider, slug] = modelId(model).split("/");
    if (!provider || !slug) continue;
    const dir = path.join(DIST_DIR, "models", provider);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${slug}.html`), await renderModelPage(model, models), "utf8");
  }

  await fs.mkdir(path.join(DIST_DIR, "providers"), { recursive: true });
  for (const provider of uniqueProviders(models)) {
    const providerModels = models.filter((m) => m.provider === provider);
    const html = await renderProviderPage(provider, providerModels, models);
    await fs.writeFile(path.join(DIST_DIR, "providers", `${provider}.html`), html, "utf8");
  }

  await fs.writeFile(path.join(DIST_DIR, "glossary.html"), await renderGlossaryPage(models), "utf8");
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
      paramsByModelApiKey: "/api/v1/params/{model}.json",
      paramsByModelSubscription: "/api/v1/params/{model}-subscription.json",
    },
    modelCount,
    docs: "https://github.com/mnfst/modelparams.dev#api",
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
  const html = await renderIndex({ catalog, capabilities, providers, analytics: true });
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

  for (const params of listModelParamsResponses(models)) {
    await writeJson(path.join(DIST_API_DIR, "params", `${params.model}.json`), params);
  }

  console.log("Bundling client + styles...");
  await Promise.all([bundleClientScript(), compileStyles(), copyStaticAssets()]);

  console.log("Rendering model, provider, and glossary pages...");
  await writeHtmlPages(models);

  await writeLlmsFiles(models);
  await writeRobotsAndSitemap(models);

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
