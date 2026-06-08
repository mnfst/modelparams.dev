import path from "node:path";
import chokidar from "chokidar";
import { loadAllModels } from "../data/load.js";
import { CLIENT_DIR, MODELS_DIR, VIEWS_DIR } from "../data/paths.js";
import { bundleClientScript, compileStyles, copyStaticAssets } from "../build/assets.js";
import { type Model } from "../schema/model.js";
import { makeApp } from "./app.js";

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

// Ignore dotfiles by basename only. The previous regex (/(^|[\\/])\../) tested the
// full absolute path, so a dot-segment in an ancestor dir — e.g. a checkout under
// ~/.paseo/... — matched and silently disabled the entire watch.
const ignoreDotfiles = (target: string): boolean => path.basename(target).startsWith(".");

// Poll by default so the watch is reliable on container, overlay, and network
// mounts where native FS events don't propagate; set CHOKIDAR_USEPOLLING=false to
// use native events on a normal local disk. awaitWriteFinish avoids half-written reads.
const WATCH_OPTIONS = {
  ignoreInitial: true,
  ignored: ignoreDotfiles,
  usePolling: process.env.CHOKIDAR_USEPOLLING !== "false",
  interval: 300,
  binaryInterval: 600,
  awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
};

function watch(): void {
  const watcher = chokidar.watch([MODELS_DIR, VIEWS_DIR], WATCH_OPTIONS);
  watcher.on("all", async (event, file) => {
    console.log(`[dev] ${event} ${path.relative(process.cwd(), file)} — refreshing`);
    cache = null;
    await refresh();
  });

  const clientWatcher = chokidar.watch(CLIENT_DIR, WATCH_OPTIONS);
  clientWatcher.on("all", async () => {
    console.log("[dev] client changed — rebundling");
    await rebuildClientAssets();
  });
}

async function rebuildClientAssets(): Promise<void> {
  await Promise.all([bundleClientScript(false), compileStyles(), copyStaticAssets()]);
}

async function main(): Promise<void> {
  console.log("[dev] bundling client assets...");
  await rebuildClientAssets();
  await refresh();
  watch();
  const app = makeApp(async () => (await getCache()).models);
  app.listen(PORT, () => {
    console.log(`[dev] modelparams.dev → http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Dev server failed to start:", err);
  process.exit(1);
});
