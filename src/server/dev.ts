import path from "node:path";
import chokidar from "chokidar";
import express from "express";
import { buildCapabilityFacets, buildCatalog, buildProviderFacets } from "../data/catalog.js";
import { loadAllModels } from "../data/load.js";
import { CLIENT_DIR, DIST_ASSETS_DIR, MODELS_DIR, VIEWS_DIR } from "../data/paths.js";
import { buildModelJsonSchema } from "../schema/generate.js";
import { bundleClientScript, compileStyles, copyStaticAssets } from "../build/assets.js";
import { renderIndex } from "../build/render.js";
import { modelId, type Model } from "../schema/model.js";

const PORT = Number(process.env.PORT ?? 3000);

interface CacheEntry {
  models: Model[];
  refreshedAt: number;
}

let cache: CacheEntry | null = null;

async function refresh(): Promise<CacheEntry> {
  const { models, issues } = await loadAllModels();
  if (issues.length > 0) {
    console.warn(`[dev] ${issues.length} validation issue(s):`);
    for (const issue of issues) console.warn(`  ${issue.file}: ${issue.message}`);
  }
  const entry: CacheEntry = { models, refreshedAt: Date.now() };
  cache = entry;
  return entry;
}

async function getCache(): Promise<CacheEntry> {
  return cache ?? (await refresh());
}

function watch(): void {
  const watcher = chokidar.watch([MODELS_DIR, VIEWS_DIR], {
    ignoreInitial: true,
    ignored: /(^|[\\/])\../,
  });
  watcher.on("all", async (event, file) => {
    console.log(`[dev] ${event} ${path.relative(process.cwd(), file)} — refreshing`);
    cache = null;
    await refresh();
  });

  const clientWatcher = chokidar.watch(CLIENT_DIR, { ignoreInitial: true });
  clientWatcher.on("all", async () => {
    console.log("[dev] client changed — rebundling");
    await rebuildClientAssets();
  });
}

async function rebuildClientAssets(): Promise<void> {
  await Promise.all([bundleClientScript(false), compileStyles(), copyStaticAssets()]);
}

function makeApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");

  app.use("/assets", express.static(DIST_ASSETS_DIR, { maxAge: 0 }));

  app.get("/", async (_req, res, next) => {
    try {
      const { models } = await getCache();
      const catalog = buildCatalog(models);
      const capabilities = buildCapabilityFacets(models);
      const providers = buildProviderFacets(models);
      const html = await renderIndex({ catalog, capabilities, providers });
      res.setHeader("Cache-Control", "no-store");
      res.type("html").send(html);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/v1/models.json", async (_req, res, next) => {
    try {
      const { models } = await getCache();
      res.json(buildCatalog(models));
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/v1/schema.json", (_req, res) => {
    res.json(buildModelJsonSchema());
  });

  app.get("/api/v1/models/:provider/:auth/:slug.json", async (req, res, next) => {
    try {
      const { models } = await getCache();
      const wanted = `${req.params.provider}/${req.params.auth}/${req.params.slug}`;
      const model = models.find((m) => modelId(m) === wanted);
      if (!model) {
        res.status(404).json({ error: "not_found", id: wanted });
        return;
      }
      res.json({ $schema: "https://modelparameters.dev/api/v1/schema.json", ...model });
    } catch (err) {
      next(err);
    }
  });

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}

async function main(): Promise<void> {
  console.log("[dev] bundling client assets...");
  await rebuildClientAssets();
  await refresh();
  watch();
  const app = makeApp();
  app.listen(PORT, () => {
    console.log(`[dev] modelparameters.dev → http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Dev server failed to start:", err);
  process.exit(1);
});
