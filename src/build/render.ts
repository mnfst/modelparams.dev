import path from "node:path";
import ejs from "ejs";
import { describeApplicability } from "../data/applicability.js";
import { buildProviderFacets, type CapabilityFacet, type ProviderFacet } from "../data/catalog.js";
import {
  authLabel,
  conditionIcon,
  modelLabel,
  paramGroupColor,
  paramGroupIcon,
  paramGroupLabel,
  paramLabel,
  providerLabel,
} from "../data/display.js";
import { groupParams } from "../data/group.js";
import { usageGuideMarkdown } from "../data/llms.js";
import { logoFor } from "../data/logos.js";
import { VIEWS_DIR } from "../data/paths.js";
import { OG_IMAGE_PATH, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "../data/site.js";
import { absolute, modelPagePath, providerPagePath } from "../data/urls.js";
import { modelId, type Catalog, type Model } from "../schema/model.js";
import { buildHomeStructuredData } from "./structured-data.js";

const LAYOUT_PATH = path.join(VIEWS_DIR, "layout.ejs");

/** Helpers exposed to every EJS view. */
export const viewHelpers = {
  modelId,
  modelLabel,
  providerLabel,
  authLabel,
  paramGroupColor,
  paramGroupLabel,
  paramGroupIcon,
  paramLabel,
  conditionIcon,
  describeApplicability,
  groupParams,
  logoFor,
  modelPagePath,
  providerPagePath,
};

export interface HubLink {
  href: string;
  label: string;
  provider: string;
  count: number;
}

/** Sitewide footer links to each provider hub, ordered by model count. */
export function hubLinks(models: Model[]): HubLink[] {
  return buildProviderFacets(models).map((facet) => ({
    href: providerPagePath(facet.provider),
    label: providerLabel(facet.provider),
    provider: facet.provider,
    count: facet.count,
  }));
}

export interface ShellMeta {
  title: string;
  description: string;
  canonicalUrl: string;
  structuredData: string;
  providerHubs: HubLink[];
  initialThemeClass?: string;
  analytics?: boolean;
}

/** Wrap a rendered body in the shared HTML layout (head, header, footer, modal). */
export async function renderShell(meta: ShellMeta, body: string): Promise<string> {
  return ejs.renderFile(LAYOUT_PATH, {
    title: meta.title,
    description: meta.description,
    canonicalUrl: meta.canonicalUrl,
    structuredData: meta.structuredData,
    ogImageUrl: absolute(SITE_URL, OG_IMAGE_PATH),
    providerHubs: meta.providerHubs,
    helpers: viewHelpers,
    usageGuide: usageGuideMarkdown(SITE_URL),
    initialThemeClass: meta.initialThemeClass ?? "",
    analytics: meta.analytics ?? false,
    body,
  });
}

export interface RenderOptions {
  catalog: Catalog;
  capabilities: CapabilityFacet[];
  providers: ProviderFacet[];
  initialThemeClass?: string;
  /** Inject the Vercel Web Analytics snippet. Enabled for production builds; off in dev. */
  analytics?: boolean;
}

export async function renderIndex(opts: RenderOptions): Promise<string> {
  const body = await ejs.renderFile(path.join(VIEWS_DIR, "index.ejs"), {
    models: opts.catalog.models,
    capabilities: opts.capabilities,
    providers: opts.providers,
    helpers: viewHelpers,
  });

  return renderShell(
    {
      title: `${SITE_NAME} — Open catalog of LLM model parameters`,
      description: SITE_DESCRIPTION,
      canonicalUrl: `${SITE_URL}/`,
      structuredData: buildHomeStructuredData(
        opts.catalog.models,
        SITE_URL,
        absolute(SITE_URL, OG_IMAGE_PATH),
      ),
      providerHubs: hubLinks(opts.catalog.models),
      initialThemeClass: opts.initialThemeClass,
      analytics: opts.analytics,
    },
    body,
  );
}
