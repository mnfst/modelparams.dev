// JSON-LD builders for every page type. Pure functions of (data, siteUrl) so
// they can be unit-tested without touching the filesystem or the renderer.

import { modelFullLabel, modelLabel, paramLabel, providerLabel } from "../data/display.js";
import type { ModelFaq } from "../data/faq.js";
import type { GlossaryGroup } from "../data/glossary.js";
import type { ParameterDetail } from "../data/parameters.js";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME } from "../data/site.js";
import {
  DISAMBIGUATION_PATH,
  GLOSSARY_PATH,
  absolute,
  modelJsonPath,
  modelPagePath,
  parameterPagePath,
  providerPagePath,
} from "../data/urls.js";
import { type Model } from "../schema/model.js";

const REPO_URL = "https://github.com/mnfst/modelparams.dev";
const NPM_URL = "https://www.npmjs.com/package/modelparams";

/** Stable @id for the concept node every dataset on the site points `about` at. */
function conceptId(siteUrl: string): string {
  return `${siteUrl}/#api-parameter`;
}

/**
 * The subject of this whole site, stated once as an entity: an API request
 * parameter, not a trained weight. `variableMeasured` already names temperature
 * and top_p on each model page, which is good evidence of the intended sense;
 * this makes it explicit rather than inferred, so a crawler resolving "model
 * parameters" has something to bind to besides the ambiguous word itself.
 */
function apiParameterConceptNode(siteUrl: string) {
  return {
    "@type": "DefinedTerm",
    "@id": conceptId(siteUrl),
    name: "LLM API parameter",
    description:
      "A setting sent in the body of an LLM API request — temperature, top_p, max_tokens and the like. Not the same as a model parameter in the sense of a trained weight, which is what a parameter count measures.",
    inDefinedTermSet: `${siteUrl}${GLOSSARY_PATH}#termset`,
    url: absolute(siteUrl, DISAMBIGUATION_PATH),
  };
}

interface Crumb {
  name: string;
  path: string;
}

function breadcrumb(siteUrl: string, crumbs: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absolute(siteUrl, crumb.path),
    })),
  };
}

function graph(nodes: unknown[]): string {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": nodes });
}

function organizationNode(siteUrl: string) {
  return {
    "@type": "Organization",
    "@id": `${siteUrl}/#org`,
    name: SITE_NAME,
    url: `${siteUrl}/`,
    description: SITE_DESCRIPTION,
    sameAs: [REPO_URL, NPM_URL],
  };
}

function homeWebsiteNode(siteUrl: string) {
  return {
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: `${siteUrl}/`,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    publisher: { "@id": `${siteUrl}/#org` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

function homeDatasetNode(siteUrl: string, imageUrl: string) {
  return {
    "@type": "Dataset",
    "@id": `${siteUrl}/#dataset`,
    name: `${SITE_NAME} catalog`,
    description: SITE_DESCRIPTION,
    url: `${siteUrl}/`,
    image: imageUrl,
    keywords: SITE_KEYWORDS,
    about: { "@id": conceptId(siteUrl) },
    license: "https://opensource.org/licenses/MIT",
    isAccessibleForFree: true,
    creator: { "@id": `${siteUrl}/#org` },
    distribution: {
      "@type": "DataDownload",
      encodingFormat: "application/json",
      contentUrl: `${siteUrl}/api/v1/models.json`,
    },
  };
}

function homeItemListNode(models: Model[], siteUrl: string) {
  return {
    "@type": "ItemList",
    name: `${SITE_NAME} catalog`,
    description: SITE_DESCRIPTION,
    numberOfItems: models.length,
    itemListElement: models.map((model, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absolute(siteUrl, modelPagePath(model)),
      item: {
        "@type": "SoftwareApplication",
        name: modelLabel(model),
        applicationCategory: "Generative AI model",
        operatingSystem: "Cloud",
        provider: { "@type": "Organization", name: providerLabel(model.provider) },
      },
    })),
  };
}

export function buildHomeStructuredData(
  models: Model[],
  siteUrl: string,
  imageUrl: string,
): string {
  return graph([
    organizationNode(siteUrl),
    homeWebsiteNode(siteUrl),
    apiParameterConceptNode(siteUrl),
    homeDatasetNode(siteUrl, imageUrl),
    homeItemListNode(models, siteUrl),
  ]);
}

/** Both the model FAQ and the disambiguation FAQ reduce to this shape. */
interface QuestionAnswer {
  question: string;
  answer: string;
}

function faqPageNode(faqs: QuestionAnswer[], id: string) {
  return {
    "@type": "FAQPage",
    "@id": id,
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

export function buildModelStructuredData(
  model: Model,
  description: string,
  siteUrl: string,
  faqs: ModelFaq[] = [],
): string {
  const name = `${modelFullLabel(model)} API parameters`;
  const dataset = {
    "@type": "Dataset",
    "@id": `${siteUrl}${modelPagePath(model)}#dataset`,
    name,
    description,
    url: absolute(siteUrl, modelPagePath(model)),
    isPartOf: { "@id": `${siteUrl}/#dataset` },
    keywords: SITE_KEYWORDS,
    about: { "@id": conceptId(siteUrl) },
    license: "https://opensource.org/licenses/MIT",
    isAccessibleForFree: true,
    creator: { "@type": "Organization", name: SITE_NAME, url: `${siteUrl}/` },
    distribution: {
      "@type": "DataDownload",
      encodingFormat: "application/json",
      contentUrl: absolute(siteUrl, modelJsonPath(model)),
    },
    variableMeasured: model.params.map((param) => ({
      "@type": "PropertyValue",
      name: param.path,
      alternateName: paramLabel(param.path, param.label),
      description: param.description,
    })),
  };
  const crumbs = breadcrumb(siteUrl, [
    { name: "Home", path: "/" },
    { name: providerLabel(model.provider), path: providerPagePath(model.provider) },
    { name: modelLabel(model), path: modelPagePath(model) },
  ]);
  const nodes: unknown[] = [crumbs, apiParameterConceptNode(siteUrl), dataset];
  if (faqs.length > 0) {
    nodes.push(faqPageNode(faqs, `${siteUrl}${modelPagePath(model)}#faq`));
  }
  return graph(nodes);
}

export function buildProviderStructuredData(
  provider: string,
  models: Model[],
  description: string,
  siteUrl: string,
): string {
  const itemList = {
    "@type": "ItemList",
    name: `${providerLabel(provider)} API parameters`,
    description,
    numberOfItems: models.length,
    itemListElement: models.map((model, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absolute(siteUrl, modelPagePath(model)),
      name: modelLabel(model),
    })),
  };
  const crumbs = breadcrumb(siteUrl, [
    { name: "Home", path: "/" },
    { name: providerLabel(provider), path: providerPagePath(provider) },
  ]);
  return graph([crumbs, itemList]);
}

export function buildParameterStructuredData(
  detail: ParameterDetail,
  description: string,
  siteUrl: string,
): string {
  const pagePath = parameterPagePath(detail.path);
  const definedTerm = {
    "@type": "DefinedTerm",
    "@id": `${siteUrl}${pagePath}#term`,
    name: detail.label,
    termCode: detail.path,
    description,
    url: absolute(siteUrl, pagePath),
    inDefinedTermSet: `${siteUrl}${GLOSSARY_PATH}#termset`,
  };
  const itemList = {
    "@type": "ItemList",
    name: `Models that support ${detail.path}`,
    numberOfItems: detail.modelCount,
    itemListElement: detail.usages.map((usage, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absolute(siteUrl, modelPagePath(usage.model)),
      name: modelFullLabel(usage.model),
    })),
  };
  const crumbs = breadcrumb(siteUrl, [
    { name: "Home", path: "/" },
    { name: "Glossary", path: GLOSSARY_PATH },
    { name: detail.label, path: pagePath },
  ]);
  return graph([crumbs, definedTerm, itemList]);
}

/**
 * The disambiguation page is the only place on the site that should match a
 * weight-count query, so it's the only place carrying those questions in an
 * FAQPage. It states both senses and points `about` at the one this catalog
 * covers, which is what lets the model pages stay out of that result set.
 */
export function buildDisambiguationStructuredData(
  faqs: QuestionAnswer[],
  description: string,
  siteUrl: string,
): string {
  const pagePath = DISAMBIGUATION_PATH;
  const page = {
    "@type": "WebPage",
    "@id": `${siteUrl}${pagePath}#page`,
    name: "Model parameters vs. API parameters",
    url: absolute(siteUrl, pagePath),
    description,
    about: { "@id": conceptId(siteUrl) },
    isPartOf: { "@id": `${siteUrl}/#website` },
  };
  const crumbs = breadcrumb(siteUrl, [
    { name: "Home", path: "/" },
    { name: "Model parameters vs. API parameters", path: pagePath },
  ]);
  return graph([
    crumbs,
    apiParameterConceptNode(siteUrl),
    page,
    faqPageNode(faqs, `${siteUrl}${pagePath}#faq`),
  ]);
}

export function buildGlossaryStructuredData(groups: GlossaryGroup[], siteUrl: string): string {
  const terms = groups
    .flatMap((groupItem) => groupItem.entries)
    .map((entry) => ({
      "@type": "DefinedTerm",
      name: entry.label,
      termCode: entry.path,
      description: entry.description,
      inDefinedTermSet: `${siteUrl}${GLOSSARY_PATH}#termset`,
    }));
  const termSet = {
    "@type": "DefinedTermSet",
    "@id": `${siteUrl}${GLOSSARY_PATH}#termset`,
    name: "LLM API parameter glossary",
    description:
      "Definitions for the settings you send in an LLM API request. Not model weight counts.",
    url: absolute(siteUrl, GLOSSARY_PATH),
    hasDefinedTerm: terms,
  };
  const crumbs = breadcrumb(siteUrl, [
    { name: "Home", path: "/" },
    { name: "Glossary", path: GLOSSARY_PATH },
  ]);
  return graph([crumbs, termSet]);
}
