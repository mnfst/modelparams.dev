// Site-wide constants shared by the renderers, structured-data builders, and
// the build pipeline. Centralised here so the brand name and base URL are
// defined once.

export const SITE_NAME = "modelparams.dev";

export const SITE_URL = process.env.SITE_URL ?? "https://modelparams.dev";

export const SITE_DESCRIPTION =
  "An open, community-maintained catalog of LLM API parameters — the request settings like temperature and top_p, not model weight counts. API-key and subscription variants tracked separately.";

/**
 * Sense-fixing keywords for the JSON-LD. "Parameters" is ambiguous: the other
 * reading is weight count ("how many parameters does GPT-5.5 have"). These
 * name the reading this catalog actually covers.
 */
export const SITE_KEYWORDS = [
  "LLM API parameters",
  "sampling parameters",
  "inference settings",
  "request body",
  "temperature",
  "top_p",
  "max_tokens",
];

/** Path to the social-share image, relative to the site root. */
export const OG_IMAGE_PATH = "/assets/og.png";
