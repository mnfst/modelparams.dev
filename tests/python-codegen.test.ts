import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pythonLiteral, typeName } from "../packages/modelparams-python/scripts/codegen.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const releaseWorkflow = fs.readFileSync(
  path.resolve(here, "..", ".github", "workflows", "release-modelparams-python.yml"),
  "utf8",
);

describe("Python code generation", () => {
  it("prefixes generated types when a model ID starts with a digit", () => {
    expect(typeName({ model: "4o-mini", authType: "api_key" })).toBe("Model_4o_MiniParams");
  });

  it("fails clearly for float enum values unsupported by typing.Literal", () => {
    expect(() => pythonLiteral(0.5)).toThrow(/non-integer enum value 0.5/);
  });
});

describe("Python release workflow", () => {
  it("publishes idempotently and tags the triggering commit", () => {
    expect(releaseWorkflow).toContain("skip-existing: true");
    expect(releaseWorkflow).toContain("target_commitish: ${{ github.sha }}");
  });
});
