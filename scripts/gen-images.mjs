// Rasterizes favicon.svg into the apple-touch-icon PNG that iOS requires (it
// doesn't accept SVG). Run manually after editing `favicon.svg` — `sharp` is
// intentionally NOT a project dependency, so pull it in ad hoc:
//
//   npx -y -p sharp node scripts/gen-images.mjs
//
// The output is committed under src/client/ and copied into dist/assets at build.
//
// Social cards are NOT generated here: `npm run build` renders one per page from
// the catalog data (src/build/og.ts), so there is nothing to regenerate by hand.
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

await rasterize("favicon.svg", "apple-touch-icon.png", 180, 180, 600);
