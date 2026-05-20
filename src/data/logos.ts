import fs from "node:fs";
import path from "node:path";
import { CLIENT_DIR } from "./paths.js";

const LOGO_DIR = path.join(CLIENT_DIR, "logos");
const DEFAULT_SLUG = "_default";

const cache = new Map<string, string | null>();

function readLogoFile(slug: string): string | null {
  if (cache.has(slug)) return cache.get(slug)!;
  const file = path.join(LOGO_DIR, `${slug}.svg`);
  let content: string | null = null;
  try {
    content = fs.readFileSync(file, "utf8").trim();
  } catch {
    content = null;
  }
  cache.set(slug, content);
  return content;
}

export function logoFor(provider: string): string | null {
  return readLogoFile(provider) ?? readLogoFile(DEFAULT_SLUG);
}

export function listLogoFiles(): string[] {
  try {
    return fs
      .readdirSync(LOGO_DIR)
      .filter((f) => f.endsWith(".svg"))
      .map((f) => path.join(LOGO_DIR, f));
  } catch {
    return [];
  }
}
