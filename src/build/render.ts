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
import { OG_IMAGE_PATH, SITE_NAME, SITE_URL } from "../data/site.js";
import {
  absolute,
  modelPagePath,
  ogImagePath,
  parameterAnchorId,
  parameterPagePath,
  providerPagePath,
} from "../data/urls.js";
import { modelId, type Catalog, type Model } from "../schema/model.js";
import { fitDescription, fitTitle } from "./meta.js";
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
  parameterPagePath,
  parameterAnchorId,
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
  /** Root-relative path of this page's share image; falls back to the site card. */
  ogImage?: string;
  /** og:type — "website" for hubs, "article" for the content pages. */
  ogType?: string;
  /** Robots directive; omitted (index, follow) for every indexable page. */
  robots?: string;
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
    ogImageUrl: absolute(SITE_URL, meta.ogImage ?? OG_IMAGE_PATH),
    ogType: meta.ogType ?? "website",
    robots: meta.robots ?? "",
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

/**
 * Brand-first homepage title. Interior pages read "<page> · modelparams.dev";
 * the homepage inverts that so the brand leads, which is what a branded search
 * ("modelparams") and a link in a feed both want to see first. "LLM parameters"
 * is the head term people actually type — "model parameters" reads as weights
 * to an ML audience, so the descriptive half says LLM. The live count carries
 * the scale that makes the result worth clicking.
 */
export function homeTitle(modelCount: number): string {
  return fitTitle([
    `${SITE_NAME} — LLM Parameters for ${modelCount} Models`,
    `${SITE_NAME} — LLM Parameters`,
  ]);
}

/**
 * Description in sentence case (Title Case here reads as spam), opening on the
 * brand and the category it owns, then the specific parameter names users
 * search for plus the live counts.
 */
export function homeDescription(
  modelCount: number,
  providerCount: number,
  sampleParams: string[],
): string {
  const knobs =
    sampleParams.length > 0
      ? `Compare ${sampleParams.join(", ")} and every other knob`
      : "Compare every knob you can turn";
  const reach = `across ${modelCount} models from ${providerCount} providers`;
  const lead = `${SITE_NAME} is the open catalog of LLM API parameters.`;
  return fitDescription([
    `${lead} ${knobs} ${reach}, with defaults, ranges and gating conditions.`,
    `${lead} ${knobs} ${reach}.`,
    `${lead} ${knobs}.`,
  ]);
}

export async function renderIndex(opts: RenderOptions): Promise<string> {
  const body = await ejs.renderFile(path.join(VIEWS_DIR, "index.ejs"), {
    models: opts.catalog.models,
    capabilities: opts.capabilities,
    providers: opts.providers,
    helpers: viewHelpers,
  });

  const sampleParams = opts.capabilities.slice(0, 3).map((cap) => cap.path);
  return renderShell(
    {
      title: homeTitle(opts.catalog.models.length),
      description: homeDescription(opts.catalog.models.length, opts.providers.length, sampleParams),
      canonicalUrl: `${SITE_URL}/`,
      ogImage: ogImagePath("/"),
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
