// Rasterizes the brand SVGs into the PNG assets that social platforms and iOS
// require (they don't reliably accept SVG). Run manually after editing
// `og.svg` or `favicon.svg` — `sharp` is intentionally NOT a project
// dependency, so pull it in ad hoc:
//
//   npx -y -p sharp node scripts/gen-images.mjs
//
// Outputs are committed under src/client/ and copied into dist/assets at build.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(here, "..", "src", "client");

async function rasterize(srcSvg, outPng, width, height, density) {
  const svg = await readFile(path.join(clientDir, srcSvg));
  await sharp(svg, { density })
    .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(clientDir, outPng));
  console.log(`wrote src/client/${outPng} (${width}x${height})`);
}

await rasterize("og.svg", "og.png", 1200, 630, 144);
await rasterize("favicon.svg", "apple-touch-icon.png", 180, 180, 600);
