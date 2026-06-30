// JSON-LD builders for every page type. Pure functions of (data, siteUrl) so
// they can be unit-tested without touching the filesystem or the renderer.

import { modelLabel, paramLabel, providerLabel } from "../data/display.js";
import type { GlossaryGroup } from "../data/glossary.js";
import type { ParameterDetail } from "../data/parameters.js";
import { SITE_DESCRIPTION, SITE_NAME } from "../data/site.js";
import {
  GLOSSARY_PATH,
  absolute,
  modelJsonPath,
  modelPagePath,
  parameterPagePath,
  providerPagePath,
} from "../data/urls.js";
import { type Model } from "../schema/model.js";

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

function homeWebsiteNode(siteUrl: string) {
  return {
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: `${siteUrl}/`,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
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
    license: "https://opensource.org/licenses/MIT",
    isAccessibleForFree: true,
    creator: { "@type": "Organization", name: SITE_NAME, url: `${siteUrl}/` },
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
    homeWebsiteNode(siteUrl),
    homeDatasetNode(siteUrl, imageUrl),
    homeItemListNode(models, siteUrl),
  ]);
}

export function buildModelStructuredData(
  model: Model,
  description: string,
  siteUrl: string,
): string {
  const name = `${providerLabel(model.provider)} ${modelLabel(model)} parameters`;
  const dataset = {
    "@type": "Dataset",
    "@id": `${siteUrl}${modelPagePath(model)}#dataset`,
    name,
    description,
    url: absolute(siteUrl, modelPagePath(model)),
    isPartOf: { "@id": `${siteUrl}/#dataset` },
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
  return graph([crumbs, dataset]);
}

export function buildProviderStructuredData(
  provider: string,
  models: Model[],
  description: string,
  siteUrl: string,
): string {
  const itemList = {
    "@type": "ItemList",
    name: `${providerLabel(provider)} model parameters`,
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
      name: `${usage.providerName} ${usage.modelName}`,
    })),
  };
  const crumbs = breadcrumb(siteUrl, [
    { name: "Home", path: "/" },
    { name: "Glossary", path: GLOSSARY_PATH },
    { name: detail.label, path: pagePath },
  ]);
  return graph([crumbs, definedTerm, itemList]);
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
    name: "LLM parameter glossary",
    url: absolute(siteUrl, GLOSSARY_PATH),
    hasDefinedTerm: terms,
  };
  const crumbs = breadcrumb(siteUrl, [
    { name: "Home", path: "/" },
    { name: "Glossary", path: GLOSSARY_PATH },
  ]);
  return graph([crumbs, termSet]);
}
