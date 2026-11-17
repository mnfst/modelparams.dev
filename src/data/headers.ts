// Cloudflare `_headers` builder. Static files are served straight from the
// asset layer without invoking the Worker (Worker requests count against the
// free plan's daily quota; asset requests do not), so the headers vercel.json
// set on the JSON API and llms*.txt are declared here instead.

const CATALOG_CACHE = "public, max-age=300, s-maxage=3600";

const RULES: Array<[path: string, headers: Record<string, string>]> = [
  [
    "/api/v1/*",
    {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": CATALOG_CACHE,
      "X-Robots-Tag": "noindex",
    },
  ],
  ...["/llms.txt", "/llms-full.txt"].map((path): [string, Record<string, string>] => [
    path,
    {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": CATALOG_CACHE,
    },
  ]),
];

export function buildHeadersFile(): string {
  return RULES.map(
    ([path, headers]) =>
      [path, ...Object.entries(headers).map(([key, value]) => `  ${key}: ${value}`)].join("\n") +
      "\n",
  ).join("\n");
}
