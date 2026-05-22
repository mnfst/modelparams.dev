import fs from "node:fs/promises";
import path from "node:path";
import { build as esbuild } from "esbuild";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { CLIENT_DIR, DIST_ASSETS_DIR, REPO_ROOT } from "../data/paths.js";

export async function bundleClientScript(minify = true): Promise<void> {
  await esbuild({
    entryPoints: [path.join(CLIENT_DIR, "main.ts")],
    outfile: path.join(DIST_ASSETS_DIR, "main.js"),
    bundle: true,
    minify,
    format: "esm",
    target: ["es2022"],
    sourcemap: !minify,
    logLevel: "warning",
  });
}

export async function compileStyles(): Promise<void> {
  const input = await fs.readFile(path.join(CLIENT_DIR, "styles.css"), "utf8");
  const result = await postcss([
    tailwindcss({ config: path.join(REPO_ROOT, "tailwind.config.ts") }),
    autoprefixer(),
  ]).process(input, { from: path.join(CLIENT_DIR, "styles.css"), to: "styles.css" });
  await fs.writeFile(path.join(DIST_ASSETS_DIR, "styles.css"), result.css, "utf8");
}

export async function copyStaticAssets(): Promise<void> {
  await Promise.all(
    ["favicon.svg", "og.png", "apple-touch-icon.png"].map((name) =>
      fs.copyFile(path.join(CLIENT_DIR, name), path.join(DIST_ASSETS_DIR, name)),
    ),
  );

  const logoSrc = path.join(CLIENT_DIR, "logos");
  const logoDest = path.join(DIST_ASSETS_DIR, "logos");
  await fs.mkdir(logoDest, { recursive: true });
  const entries = await fs.readdir(logoSrc).catch(() => []);
  await Promise.all(
    entries
      .filter((name) => name.endsWith(".svg") && !name.startsWith("_"))
      .map((name) => fs.copyFile(path.join(logoSrc, name), path.join(logoDest, name))),
  );
}
