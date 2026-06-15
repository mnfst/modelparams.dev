import path from "node:path";
import ejs from "ejs";
import { VIEWS_DIR } from "../data/paths.js";
import { SITE_NAME, SITE_URL } from "../data/site.js";
import { absolute } from "../data/urls.js";
import { type Model } from "../schema/model.js";
import { hubLinks, renderShell, viewHelpers } from "./render.js";

const API_TITLE = `API documentation · ${SITE_NAME}`;
const API_DESCRIPTION =
  "How to use the modelparams.dev JSON API, npm package, and provider logos. Static, CORS-enabled, served from the edge.";

export async function renderApiPage(allModels: Model[]): Promise<string> {
  const body = await ejs.renderFile(path.join(VIEWS_DIR, "api.ejs"), {
    helpers: viewHelpers,
  });

  return renderShell(
    {
      title: API_TITLE,
      description: API_DESCRIPTION,
      canonicalUrl: absolute(SITE_URL, "/api"),
      structuredData: "{}",
      providerHubs: hubLinks(allModels),
    },
    body,
  );
}
