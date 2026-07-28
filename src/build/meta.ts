// Length budgets for the <title> and <meta name="description"> the renderers
// emit. Google truncates titles around 60 characters and descriptions around
// 160, so anything past those limits is markup nobody reads. The helpers here
// let each renderer offer a few phrasings, longest first, and take the richest
// one that still fits — instead of hardcoding a shape that overflows on the
// longest model names and nested parameter paths.

/** Titles are cut near 60 characters in the SERP. */
export const TITLE_MAX = 60;

/** Descriptions are cut near 160; 158 leaves room for the trailing period. */
export const DESCRIPTION_MAX = 158;

/** The first candidate that fits `max`, or the last (shortest) one if none do. */
export function fitText(candidates: string[], max: number): string {
  return candidates.find((candidate) => candidate.length <= max) ?? candidates.at(-1)!;
}

/** Pick the richest title phrasing that survives truncation. */
export function fitTitle(candidates: string[]): string {
  return fitText(candidates, TITLE_MAX);
}

/** Pick the richest description phrasing that survives truncation. */
export function fitDescription(candidates: string[]): string {
  return fitText(candidates, DESCRIPTION_MAX);
}

/**
 * As many comma-separated items as fit `budget` characters, plus whether any
 * were left out — so a description can size its parameter sample to the space
 * actually remaining after the surrounding prose.
 */
export function fitList(items: string[], budget: number): { text: string; truncated: boolean } {
  const kept: string[] = [];
  let width = 0;
  for (const item of items) {
    const next = width === 0 ? item.length : width + 2 + item.length;
    if (next > budget) break;
    kept.push(item);
    width = next;
  }
  return { text: kept.join(", "), truncated: kept.length < items.length };
}

const MORE = ", and more";

/**
 * A comma-separated sample of `items` that fits `budget`, appending ", and more"
 * when the list had to be cut. Always names at least one item, even if that
 * nudges past the budget — a bare "and more" tells the reader nothing.
 */
export function sampleList(items: string[], budget: number): string {
  if (items.length === 0) return "";
  const full = fitList(items, budget);
  if (!full.truncated) return full.text;
  const trimmed = fitList(items, budget - MORE.length);
  return trimmed.text.length > 0 ? `${trimmed.text}${MORE}` : `${items[0]!}${MORE}`;
}
