import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { CLIENT_DIR } from "./paths.js";

const require = createRequire(import.meta.url);
const LOBE_ICONS_DIR = path.join(
  path.dirname(require.resolve("@lobehub/icons-static-svg/package.json")),
  "icons",
);
const LOCAL_LOGO_DIR = path.join(CLIENT_DIR, "logos");

/**
 * Map our provider slugs to lobe-icons filenames.
 * Prefer `-color` variants when they exist for multi-color logos.
 */
const SLUG_TO_LOBE: Record<string, string> = {
  openai: "openai",
  anthropic: "anthropic",
  google: "google-color",
  meta: "meta",
  mistral: "mistral-color",
  cohere: "cohere-color",
  deepseek: "deepseek-color",
  xai: "xai",
  perplexity: "perplexity-color",
  minimax: "minimax",
  moonshot: "moonshot",
  alibaba: "alibabacloud-color",
  "z-ai": "zai",
  groq: "groq",
  cerebras: "cerebras-color",
};

const cache = new Map<string, string | null>();

function readSvg(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return null;
  }
}

function readLogo(slug: string): string | null {
  if (cache.has(slug)) return cache.get(slug)!;

  let content: string | null = null;

  // 1. Try lobe-icons mapping
  const lobeName = SLUG_TO_LOBE[slug];
  if (lobeName) {
    content = readSvg(path.join(LOBE_ICONS_DIR, `${lobeName}.svg`));
  }

  // 2. Fall back to local logos dir
  if (!content) {
    content = readSvg(path.join(LOCAL_LOGO_DIR, `${slug}.svg`));
  }

  cache.set(slug, content);
  return content;
}

let logoInstanceCounter = 0;

/** Make gradient/filter IDs unique per SVG instance to avoid collisions. */
function dedupeIds(svg: string): string {
  const suffix = `_${++logoInstanceCounter}`;
  const ids = new Set<string>();
  // Collect all id="..." values
  svg.replace(/\bid="([^"]+)"/g, (_, id) => {
    ids.add(id);
    return _;
  });
  if (ids.size === 0) return svg;
  let result = svg;
  for (const id of ids) {
    result = result.replaceAll(`id="${id}"`, `id="${id}${suffix}"`);
    result = result.replaceAll(`#${id})`, `#${id}${suffix})`);
    result = result.replaceAll(`"#${id}"`, `"#${id}${suffix}"`);
  }
  return result;
}

export function logoFor(provider: string): string | null {
  const svg = readLogo(provider) ?? readLogo("_default");
  return svg ? dedupeIds(svg) : null;
}

export function listLogoFiles(): string[] {
  try {
    return fs
      .readdirSync(LOCAL_LOGO_DIR)
      .filter((f) => f.endsWith(".svg"))
      .map((f) => path.join(LOCAL_LOGO_DIR, f));
  } catch {
    return [];
  }
}
