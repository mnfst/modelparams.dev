import path from "node:path";
import ejs from "ejs";
import { disambiguationFaq } from "../data/disambiguation.js";
import { VIEWS_DIR } from "../data/paths.js";
import { SITE_NAME, SITE_URL } from "../data/site.js";
import { DISAMBIGUATION_PATH, GLOSSARY_PATH, absolute, ogImagePath } from "../data/urls.js";
import { type Model } from "../schema/model.js";
import { buildDisambiguationStructuredData } from "./structured-data.js";
import { hubLinks, renderShell, viewHelpers } from "./render.js";

const TITLE = `Model parameters vs. API parameters · ${SITE_NAME}`;

// Names both senses in the snippet. Someone searching for a weight count should
// be able to tell from the SERP that this page answers them and that the rest of
// the site won't.
const DESCRIPTION =
  "A model's parameter count is its trained weights. API parameters are the request settings like temperature and top_p. Which one you want, and where to find it.";

export async function renderDisambiguationPage(allModels: Model[]): Promise<string> {
  const faqs = disambiguationFaq(allModels.length);
  const body = await ejs.renderFile(path.join(VIEWS_DIR, "disambiguation.ejs"), {
    helpers: viewHelpers,
    faqs,
    modelCount: allModels.length,
    glossaryPath: GLOSSARY_PATH,
  });

  return renderShell(
    {
      title: TITLE,
      description: DESCRIPTION,
      canonicalUrl: absolute(SITE_URL, DISAMBIGUATION_PATH),
      ogImage: ogImagePath(DISAMBIGUATION_PATH),
      ogType: "article",
      structuredData: buildDisambiguationStructuredData(faqs, DESCRIPTION, SITE_URL),
      providerHubs: hubLinks(allModels),
    },
    body,
  );
}
