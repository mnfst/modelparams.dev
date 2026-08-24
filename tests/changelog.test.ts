import { describe, expect, it } from "vitest";
import { insertChangelogEntry } from "../scripts/lib/changelog.js";

const seed = `# Changelog

Entries are generated when a release PR is prepared.
`;

describe("insertChangelogEntry", () => {
  it("keeps the preamble above the first entry", () => {
    const result = insertChangelogEntry(seed, "0.0.42", "- something");
    expect(result).toBe(`# Changelog

Entries are generated when a release PR is prepared.

## 0.0.42

- something
`);
  });

  it("puts a new entry above the previous one", () => {
    const once = insertChangelogEntry(seed, "0.0.42", "- first");
    const twice = insertChangelogEntry(once, "0.0.43", "- second");
    expect(twice.indexOf("## 0.0.43")).toBeLessThan(twice.indexOf("## 0.0.42"));
    expect(twice.indexOf("Entries are generated")).toBeLessThan(twice.indexOf("## 0.0.43"));
    expect(twice).toContain("- first");
  });

  it("handles a file that is nothing but a title", () => {
    expect(insertChangelogEntry("# Changelog\n", "1.0.0", "- boom")).toBe(
      "# Changelog\n\n## 1.0.0\n\n- boom\n",
    );
  });
});
