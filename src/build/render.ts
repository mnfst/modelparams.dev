import path from "node:path";
import ejs from "ejs";
import { describeApplicability } from "../data/applicability.js";
import {
  type CapabilityFacet,
  type ProviderFacet,
} from "../data/catalog.js";
import {
  authLabel,
  conditionIcon,
  modelLabel,
  paramGroupIcon,
  paramGroupLabel,
  providerLabel,
} from "../data/display.js";
import { groupParams } from "../data/group.js";
import { usageGuideMarkdown } from "../data/llms.js";
import { logoFor } from "../data/logos.js";
import { VIEWS_DIR } from "../data/paths.js";
import { modelId, type Catalog, type Model } from "../schema/model.js";

const SITE_URL = process.env.SITE_URL ?? "https://modelparams.dev";
const SITE_DESCRIPTION =
  "An open, community-maintained catalog of LLM model parameters. Search and filter every knob you can turn — API-key and subscription variants tracked separately.";

export interface RenderOptions {
  catalog: Catalog;
  capabilities: CapabilityFacet[];
  providers: ProviderFacet[];
  initialThemeClass?: string;
}

function buildStructuredData(models: Model[]): string {
  const website = {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: `${SITE_URL}/`,
    name: "modelparameters.dev",
    description: SITE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
  const dataset = {
    "@type": "Dataset",
    "@id": `${SITE_URL}/#dataset`,
    name: "modelparameters.dev catalog",
    description: SITE_DESCRIPTION,
    url: `${SITE_URL}/`,
    license: "https://opensource.org/licenses/MIT",
    isAccessibleForFree: true,
    creator: { "@type": "Organization", name: "modelparameters.dev", url: `${SITE_URL}/` },
    distribution: {
      "@type": "DataDownload",
      encodingFormat: "application/json",
      contentUrl: `${SITE_URL}/api/v1/models.json`,
    },
  };
  const itemList = {
    "@type": "ItemList",
    name: "modelparams.dev catalog",
    description: SITE_DESCRIPTION,
    numberOfItems: models.length,
    itemListElement: models.slice(0, 50).map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "SoftwareApplication",
        name: modelLabel(m),
        applicationCategory: "Generative AI model",
        operatingSystem: "Cloud",
        provider: { "@type": "Organization", name: providerLabel(m.provider) },
      },
    })),
  };
  return JSON.stringify({ "@context": "https://schema.org", "@graph": [website, dataset, itemList] });
}

export async function renderIndex(opts: RenderOptions): Promise<string> {
  const indexPath = path.join(VIEWS_DIR, "index.ejs");
  const layoutPath = path.join(VIEWS_DIR, "layout.ejs");
  const helpers = {
    modelId,
    modelLabel,
    providerLabel,
    authLabel,
    paramGroupLabel,
    paramGroupIcon,
    conditionIcon,
    describeApplicability,
    groupParams,
    logoFor,
  };

  const body = await ejs.renderFile(indexPath, {
    models: opts.catalog.models,
    capabilities: opts.capabilities,
    providers: opts.providers,
    helpers,
  });

  const html = await ejs.renderFile(layoutPath, {
    title: "modelparams.dev — Open catalog of LLM model parameters",
    description: SITE_DESCRIPTION,
    canonicalUrl: SITE_URL,
    initialThemeClass: opts.initialThemeClass ?? "",
    structuredData: buildStructuredData(opts.catalog.models),
    usageGuide: usageGuideMarkdown(SITE_URL),
    body,
  });

  return html;
}
