import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadAllModels } from "../src/data/load.js";
import { modelId } from "../src/schema/model.js";

let tmpRoot: string;

const VALID_OPUS = `provider: anthropic
authType: api_key
model: claude-opus-4-7
params:
  - path: temperature
    type: number
    label: Temperature
    description: Sampling temperature.
    default: 1.0
    range:
      min: 0
      max: 1
    group: sampling
`;

const VALID_OPUS_SUB = `provider: anthropic
authType: subscription
model: claude-opus-4-7
params:
  - path: response_style
    type: enum
    label: Response style
    description: Tone preset.
    default: normal
    values: [normal, concise]
    group: output_format
`;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mp-test-"));
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function writeModel(rel: string, body: string): Promise<void> {
  const full = path.join(tmpRoot, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body, "utf8");
}

describe("loadAllModels", () => {
  it("loads valid YAML files (api_key is bare, subscription is suffixed)", async () => {
    await writeModel("anthropic/claude-opus-4-7.yaml", VALID_OPUS);
    await writeModel("anthropic/claude-opus-4-7-subscription.yaml", VALID_OPUS_SUB);

    const result = await loadAllModels(tmpRoot);
    expect(result.issues).toEqual([]);
    expect(result.models).toHaveLength(2);
    expect(result.models.map(modelId).sort()).toEqual([
      "anthropic/claude-opus-4-7",
      "anthropic/claude-opus-4-7-subscription",
    ]);
  });

  it("flags provider/path mismatch", async () => {
    await writeModel("openai/claude-opus-4-7.yaml", VALID_OPUS);
    const result = await loadAllModels(tmpRoot);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.message).toMatch(/does not match expected id/);
  });

  it("flags an api_key model placed in a -subscription filename", async () => {
    await writeModel("anthropic/claude-opus-4-7-subscription.yaml", VALID_OPUS);
    const result = await loadAllModels(tmpRoot);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.message).toMatch(/does not match expected id/);
  });

  it("flags a subscription model placed in a bare filename", async () => {
    await writeModel("anthropic/claude-opus-4-7.yaml", VALID_OPUS_SUB);
    const result = await loadAllModels(tmpRoot);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.message).toMatch(/does not match expected id/);
  });

  it("reports YAML parse errors", async () => {
    await writeModel("anthropic/broken.yaml", "provider: anthropic\n  : : :");
    const result = await loadAllModels(tmpRoot);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
