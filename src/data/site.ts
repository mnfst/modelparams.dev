// Site-wide constants shared by the renderers, structured-data builders, and
// the build pipeline. Centralised here so the brand name and base URL are
// defined once.

export const SITE_NAME = "modelparams.dev";

export const SITE_URL = process.env.SITE_URL ?? "https://modelparams.dev";

export const SITE_DESCRIPTION =
  "An open, community-maintained catalog of model parameters. Search and filter every knob you can turn — API-key and subscription variants tracked separately.";

/** Path to the social-share image, relative to the site root. */
export const OG_IMAGE_PATH = "/assets/og.png";
