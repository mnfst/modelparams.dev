import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../src/data/paths.js";
import { buildRobotsTxt } from "../src/data/robots.js";

const SITE = "https://modelparams.dev";

describe("buildRobotsTxt", () => {
  const robots = buildRobotsTxt(SITE);

  it("allows crawling and points at the sitemap and llms.txt", () => {
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
    expect(robots).toContain(`${SITE}/llms.txt`);
  });

  it("never disallows the JSON API, which would hide its noindex header", () => {
    expect(robots).not.toMatch(/^Disallow:\s*\/api/m);
  });

  it("ends with a trailing newline", () => {
    expect(robots.endsWith("\n")).toBe(true);
  });
});

describe("vercel.json crawl headers", () => {
  const config = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "vercel.json"), "utf8")) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };

  // Production serves dist/ statically, so vercel.json — not the Express app — is
  // what actually keeps the JSON API out of the search index.
  it("serves /api/v1 with X-Robots-Tag: noindex", () => {
    const rule = config.headers.find((entry) => entry.source === "/api/v1/(.*)");
    expect(rule).toBeTruthy();
    expect(rule!.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex" });
  });

  it("does not noindex anything outside /api/v1", () => {
    const noindexed = config.headers
      .filter((entry) => entry.headers.some((header) => header.key === "X-Robots-Tag"))
      .map((entry) => entry.source);
    expect(noindexed).toEqual(["/api/v1/(.*)"]);
  });
});
