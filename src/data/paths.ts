import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(here, "..", "..");
export const MODELS_DIR = path.join(REPO_ROOT, "models");
export const VIEWS_DIR = path.join(REPO_ROOT, "src", "views");
export const CLIENT_DIR = path.join(REPO_ROOT, "src", "client");
export const DIST_DIR = path.join(REPO_ROOT, "dist");
export const DIST_API_DIR = path.join(DIST_DIR, "api", "v1");
export const DIST_ASSETS_DIR = path.join(DIST_DIR, "assets");
