import { describe, expect, it } from "vitest";
import {
  BY_ID,
  CATALOG,
  DEFAULTS,
  MODEL_IDS,
  PROVIDERS,
  getDefaults,
  getModel,
  getParam,
  listAllModels,
  listModels,
} from "../src/index.js";

const HAIKU = "anthropic/claude-haiku-4-5-20251001" as const;

describe("MODEL_IDS / PROVIDERS", () => {
  it("contains at least one model and one provider", () => {
    expect(MODEL_IDS.length).toBeGreaterThan(0);
    expect(PROVIDERS.length).toBeGreaterThan(0);
  });

  it("includes the Anthropic Haiku 4.5 model id", () => {
    expect(MODEL_IDS).toContain(HAIKU);
  });

  it("contains only kebab-case provider slugs", () => {
    for (const p of PROVIDERS) {
      expect(p).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    }
  });

  it("contains no duplicate model ids", () => {
    expect(new Set(MODEL_IDS).size).toBe(MODEL_IDS.length);
  });
});

describe("CATALOG / BY_ID", () => {
  it("CATALOG has the same length as MODEL_IDS", () => {
    expect(CATALOG.length).toBe(MODEL_IDS.length);
  });

  it("BY_ID has an entry for every model id", () => {
    for (const id of MODEL_IDS) {
      expect(BY_ID[id]).toBeDefined();
    }
  });

  it("BY_ID is read-only at runtime", () => {
    expect(Object.isFrozen(BY_ID)).toBe(true);
  });
});

describe("getModel", () => {
  it("returns the expected model entry", () => {
    const m = getModel(HAIKU);
    expect(m.provider).toBe("anthropic");
    expect(m.authType).toBe("api_key");
    expect(m.model).toBe("claude-haiku-4-5-20251001");
    expect(m.params.length).toBeGreaterThan(0);
  });
});

describe("getDefaults", () => {
  it("includes max_tokens=4096 for Haiku 4.5", () => {
    const d = getDefaults(HAIKU);
    expect(d.max_tokens).toBe(4096);
  });

  it("uses the catalog default for enum params", () => {
    const d = getDefaults(HAIKU);
    expect(d["thinking.type"]).toBe("disabled");
  });

  it("matches DEFAULTS[id] directly", () => {
    expect(getDefaults(HAIKU)).toBe(DEFAULTS[HAIKU]);
  });
});

describe("listModels", () => {
  it("returns the full list when no provider is given", () => {
    expect(listModels()).toBe(MODEL_IDS);
  });

  it("filters by provider", () => {
    const anthropic = listModels({ provider: "anthropic" });
    expect(anthropic.length).toBeGreaterThan(0);
    for (const id of anthropic) {
      expect(id.startsWith("anthropic/")).toBe(true);
    }
  });
});

describe("getParam", () => {
  it("returns the parameter definition for a known path", () => {
    const p = getParam(HAIKU, "thinking.type");
    expect(p).toBeDefined();
    expect(p?.type).toBe("enum");
    if (p?.type === "enum") {
      expect(p.values).toEqual(expect.arrayContaining(["disabled", "enabled"]));
    }
  });

  it("returns undefined for an unknown path", () => {
    const p = getParam(HAIKU, "definitely.not.a.param");
    expect(p).toBeUndefined();
  });
});

describe("listAllModels", () => {
  it("returns the CATALOG", () => {
    expect(listAllModels()).toBe(CATALOG);
  });
});
