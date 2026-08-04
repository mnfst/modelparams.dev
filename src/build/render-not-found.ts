import path from "node:path";
import ejs from "ejs";
import { VIEWS_DIR } from "../data/paths.js";
import { SITE_NAME, SITE_URL } from "../data/site.js";
import { GLOSSARY_PATH, absolute } from "../data/urls.js";
import { type Model } from "../schema/model.js";
import { hubLinks, renderShell, viewHelpers } from "./render.js";

const NOT_FOUND_TITLE = `Page not found · ${SITE_NAME}`;
const NOT_FOUND_DESCRIPTION =
  "That page isn't in the catalog. Browse every tracked model, provider, and LLM API parameter on modelparams.dev.";

/**
 * Branded 404 with real navigation, so a bad link lands on something useful
 * instead of the host's default page. Carries `noindex` — a soft-404 in the
 * index is worse than no page at all — but stays crawlable so the links work.
 */
export async function renderNotFoundPage(allModels: Model[]): Promise<string> {
  const providerHubs = hubLinks(allModels);
  const body = await ejs.renderFile(path.join(VIEWS_DIR, "not-found.ejs"), {
    helpers: viewHelpers,
    providerHubs,
    glossaryPath: GLOSSARY_PATH,
  });

  return renderShell(
    {
      title: NOT_FOUND_TITLE,
      description: NOT_FOUND_DESCRIPTION,
      canonicalUrl: absolute(SITE_URL, "/404"),
      structuredData: "{}",
      providerHubs,
      robots: "noindex, follow",
    },
    body,
  );
}
