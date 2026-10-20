import { describe, expect, it } from "vitest";
import { buildHeadersFile } from "../src/data/headers.js";

describe("buildHeadersFile", () => {
  const file = buildHeadersFile();

  it("types and caches the static JSON API", () => {
    expect(file).toContain(
      [
        "/api/v1/*",
        "  Content-Type: application/json; charset=utf-8",
        "  Access-Control-Allow-Origin: *",
        "  Cache-Control: public, max-age=300, s-maxage=3600",
        "  X-Robots-Tag: noindex",
      ].join("\n"),
    );
  });

  it.each(["/llms.txt", "/llms-full.txt"])("serves %s as plain text with CORS", (path) => {
    expect(file).toContain(`${path}\n  Access-Control-Allow-Origin: *\n  Content-Type: text/plain`);
  });
});
