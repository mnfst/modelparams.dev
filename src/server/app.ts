import express from "express";
import { buildCapabilityFacets, buildCatalog, buildProviderFacets } from "../data/catalog.js";
import { buildLlmsFullTxt, buildLlmsTxt } from "../data/llms.js";
import { findModelParams } from "../data/model-params.js";
import { buildParameterIndex } from "../data/parameters.js";
import { DIST_ASSETS_DIR } from "../data/paths.js";
import { buildModelJsonSchema } from "../schema/generate.js";
import { renderIndex } from "../build/render.js";
import { renderModelPage } from "../build/render-model.js";
import { renderParameterPage } from "../build/render-parameter.js";
import { renderProviderPage } from "../build/render-provider.js";
import { renderGlossaryPage } from "../build/render-glossary.js";
import { renderApiPage } from "../build/render-api.js";
import { SITE_URL } from "../data/site.js";
import { modelId, type Model } from "../schema/model.js";

/**
 * Supplies the catalog to each request. The dev server passes a caching loader;
 * tests pass a fixed array. Keeping the data source injectable lets the routes be
 * exercised over real HTTP without booting the file watcher or the bundler.
 */
export type LoadModels = () => Promise<Model[]>;

/** Build the HTTP app that serves the site, the JSON API, and the llms.txt feeds. */
export function makeApp(loadModels: LoadModels): express.Express {
  const app = express();
  app.disable("x-powered-by");

  app.use("/assets", express.static(DIST_ASSETS_DIR, { maxAge: 0 }));

  app.get("/", async (_req, res, next) => {
    try {
      const models = await loadModels();
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

  app.get("/api", async (_req, res, next) => {
    try {
      const models = await loadModels();
      res.setHeader("Cache-Control", "no-store");
      res.type("html").send(await renderApiPage(models));
    } catch (err) {
      next(err);
    }
  });

  app.get("/glossary", async (_req, res, next) => {
    try {
      const models = await loadModels();
      res.setHeader("Cache-Control", "no-store");
      res.type("html").send(await renderGlossaryPage(models));
    } catch (err) {
      next(err);
    }
  });

  app.get("/parameters/:slug", async (req, res, next) => {
    try {
      const models = await loadModels();
      const detail = buildParameterIndex(models).find((d) => d.slug === req.params.slug);
      if (!detail) {
        res.status(404).type("text/plain").send("Unknown parameter");
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      res.type("html").send(await renderParameterPage(detail, models));
    } catch (err) {
      next(err);
    }
  });

  app.get("/providers/:provider", async (req, res, next) => {
    try {
      const models = await loadModels();
      const providerModels = models.filter((m) => m.provider === req.params.provider);
      if (providerModels.length === 0) {
        res.status(404).type("text/plain").send("Unknown provider");
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      res.type("html").send(await renderProviderPage(req.params.provider, providerModels, models));
    } catch (err) {
      next(err);
    }
  });

  app.get("/models/:provider/:slug", async (req, res, next) => {
    try {
      const models = await loadModels();
      const wanted = `${req.params.provider}/${req.params.slug}`;
      const model = models.find((m) => modelId(m) === wanted);
      if (!model) {
        res.status(404).type("text/plain").send("Unknown model");
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      res.type("html").send(await renderModelPage(model, models));
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/v1/models.json", async (_req, res, next) => {
    try {
      const models = await loadModels();
      res.json(buildCatalog(models));
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/v1/schema.json", (_req, res) => {
    res.json(buildModelJsonSchema());
  });

  app.get("/api/v1/params/:slug.json", async (req, res, next) => {
    try {
      const params = findModelParams(await loadModels(), req.params.slug);
      if (!params) {
        res.status(404).json({ error: "not_found", model: req.params.slug });
        return;
      }
      res.json(params);
    } catch (err) {
      next(err);
    }
  });

  app.get("/llms.txt", async (_req, res, next) => {
    try {
      const models = await loadModels();
      res.type("text/plain; charset=utf-8").send(buildLlmsTxt(SITE_URL, models));
    } catch (err) {
      next(err);
    }
  });

  app.get("/llms-full.txt", async (_req, res, next) => {
    try {
      const models = await loadModels();
      res.type("text/plain; charset=utf-8").send(buildLlmsFullTxt(SITE_URL, models));
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/v1/models/:provider/:slug.json", async (req, res, next) => {
    try {
      const models = await loadModels();
      const wanted = `${req.params.provider}/${req.params.slug}`;
      const model = models.find((m) => modelId(m) === wanted);
      if (!model) {
        res.status(404).json({ error: "not_found", id: wanted });
        return;
      }
      res.json({ $schema: "https://modelparams.dev/api/v1/schema.json", ...model });
    } catch (err) {
      next(err);
    }
  });

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
