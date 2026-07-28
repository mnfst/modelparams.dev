// robots.txt builder. Kept as a pure function of the site origin so the crawl
// policy is unit-testable instead of buried in the build script.

/**
 * Crawl policy for the site.
 *
 * The JSON API under /api/v1 is deliberately left crawlable: it is served with
 * `X-Robots-Tag: noindex` (see vercel.json and src/server/app.ts), and a
 * `Disallow` here would hide that header from crawlers — Google would keep the
 * already-discovered endpoints in the index as bare URLs instead of dropping
 * them. Search engines belong on the HTML pages; the JSON is for programmatic
 * callers, which ignore robots directives anyway.
 */
export function buildRobotsTxt(siteUrl: string): string {
  return [
    `# AI agents welcome. Machine-readable overview: ${siteUrl}/llms.txt`,
    "User-agent: *",
    "Allow: /",
    "",
    "# /api/v1/*.json is crawlable on purpose so crawlers can read its noindex",
    "# header. Do not Disallow it — that would strand those URLs in the index.",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ].join("\n");
}
