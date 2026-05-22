import path from "node:path";
import ejs from "ejs";
import { buildGlossary, type GlossaryGroup } from "../data/glossary.js";
import { VIEWS_DIR } from "../data/paths.js";
import { SITE_NAME, SITE_URL } from "../data/site.js";
import { GLOSSARY_PATH, absolute } from "../data/urls.js";
import { type Model } from "../schema/model.js";
import { buildGlossaryStructuredData } from "./structured-data.js";
import { hubLinks, renderShell, viewHelpers } from "./render.js";

const GLOSSARY_TITLE = `LLM parameter glossary · ${SITE_NAME}`;

const GLOSSARY_DESCRIPTION =
  "Every LLM API parameter in the catalog, defined: what temperature, top_p, max_tokens, reasoning effort and the rest do, with their types and which models support them.";

function glossaryIntro(groups: GlossaryGroup[]): string {
  const total = groups.reduce((sum, groupItem) => sum + groupItem.entries.length, 0);
  return `${total} parameters appear across the catalog. This page defines each one, grouped by what it controls, and notes its type and how many models expose it. Definitions come from the same community-maintained data as the JSON API.`;
}

export async function renderGlossaryPage(allModels: Model[]): Promise<string> {
  const groups = buildGlossary(allModels);

  const body = await ejs.renderFile(path.join(VIEWS_DIR, "glossary.ejs"), {
    groups,
    intro: glossaryIntro(groups),
    helpers: viewHelpers,
  });

  return renderShell(
    {
      title: GLOSSARY_TITLE,
      description: GLOSSARY_DESCRIPTION,
      canonicalUrl: absolute(SITE_URL, GLOSSARY_PATH),
      structuredData: buildGlossaryStructuredData(groups, SITE_URL),
      providerHubs: hubLinks(allModels),
    },
    body,
  );
}
