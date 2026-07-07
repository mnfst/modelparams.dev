# modelparams

> **Typed model parameters for TypeScript.** Generated from the open [modelparams.dev](https://modelparams.dev) catalog.

```bash
npm install modelparams
```

Stop guessing which knobs each model accepts. Get autocomplete on every parameter, compile-time errors on typos and unsupported settings, and the catalog's defaults at runtime — for every provider in one tiny zero-dependency package.

**Catalog & API:** [browse the catalog](https://modelparams.dev) · [JSON API](https://modelparams.dev/api/v1/models.json) · [API docs](https://modelparams.dev/api) · [llms.txt](https://modelparams.dev/llms.txt)

## Why

You're calling `claude-opus-4-7` with `frequency_penalty` set. TypeScript doesn't tell you the param doesn't exist. The provider silently ignores it. Your evals drift. Multiply by every model in your router.

`modelparams` makes the catalog of supported parameters a first-class TypeScript citizen, the same way `tokenlens` does for context windows and pricing.

## Usage

### Per-model parameter typing — the headline feature

```ts
import type { ParamsOf } from "modelparams";
import Anthropic from "@anthropic-ai/sdk";

const params: ParamsOf<"anthropic/claude-opus-4-7"> = {
  max_tokens: 8192,
  temperature: 0.7,
  "thinking.type": "enabled",
  "thinking.budget_tokens": 4096,
  // frequency_penalty: 0.5, // ❌ TYPE ERROR — Anthropic doesn't expose this knob
};

await new Anthropic().messages.create({
  model: "claude-opus-4-7",
  messages: [...],
  ...params,
});
```

Autocomplete on every key. Autocomplete on every enum value. A compile error on the typo before it ships.

### Defaults at runtime

```ts
import { getDefaults } from "modelparams";

const defaults = getDefaults("anthropic/claude-haiku-4-5-20251001");
// { max_tokens: 4096, temperature: 1, top_p: 1, top_k: 0, "thinking.type": "disabled", ... }

const params = { ...defaults, temperature: 0.2 };
```

### Model picker UI

```ts
import { listModels, getModel } from "modelparams";

for (const id of listModels({ provider: "anthropic" })) {
  const m = getModel(id);
  m.params.filter((p) => p.group === "sampling").forEach((p) => renderSlider(p));
}
```

### Discover what a model supports

```ts
import { getParam } from "modelparams";

const thinking = getParam("anthropic/claude-opus-4-7", "thinking.type");
if (thinking?.type === "enum") {
  console.log(thinking.values); // ["disabled", "enabled"]
}
```

### Validate untrusted params at runtime

`ParamsOf<Id>` is compile-time only — it can't help against a JSON request body. `parseParams` validates an untrusted object against the catalog (unknown keys, numeric ranges, enum values):

```ts
import { parseParams } from "modelparams";

app.post("/chat", (req, res) => {
  const result = parseParams("openai/gpt-4.1", req.body.params);
  if (!result.success) return res.status(422).json({ issues: result.issues });
  openai.chat.completions.create({ model: "gpt-4.1", messages, ...result.value });
});
```

Prefer a schema? `paramsSchema(id)` returns a [Standard Schema](https://standardschema.dev), so it drops into tRPC, Hono, TanStack Form, and anything else that speaks the spec:

```ts
import { paramsSchema } from "modelparams";

app.post("/chat", validator("json", paramsSchema("openai/gpt-4.1")), handler);
```

## API

### Types

| Type                 | Description                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `ParamsOf<Id>`       | Optional parameters for model `Id`. The headline type.                                                                |
| `StrictParamsOf<Id>` | Same shape, every field required.                                                                                     |
| `ModelId`            | Union of all `"provider/model"` ids (including `-subscription` variants).                                             |
| `Provider`           | Union of provider slugs (`"anthropic"`, `"openai"`, …).                                                               |
| `ParamsById`         | Mapped type: `{ [Id in ModelId]: ParamsByIdMap[Id] }`.                                                                |
| `CatalogEntry`       | The full catalog object for one model.                                                                                |
| `Param`              | A parameter definition in a loose, iterable shape — `getModel(id).params` assigns to `readonly Param[]` with no cast. |
| `ParseParamsResult`  | The discriminated result of `parseParams`.                                                                            |
| `StandardSchemaV1`   | The [Standard Schema](https://standardschema.dev) interface `paramsSchema` returns.                                   |

### Functions

| Function                   | Description                                                 |
| -------------------------- | ----------------------------------------------------------- |
| `getModel(id)`             | The full catalog entry for a model id.                      |
| `getDefaults(id)`          | The catalog-declared defaults.                              |
| `getParam(id, path)`       | A single parameter's definition (range, enum values, etc.). |
| `listModels({ provider })` | List model ids, optionally filtered by provider.            |
| `listAllModels()`          | The full `CATALOG` array.                                   |
| `parseParams(id, input)`   | Validate an untrusted params object against the catalog.    |
| `paramsSchema(id)`         | A Standard Schema that validates a params object for `id`.  |

### Constants

| Constant    | Description                                        |
| ----------- | -------------------------------------------------- |
| `MODEL_IDS` | Frozen tuple of every model id (drives `ModelId`). |
| `PROVIDERS` | Frozen tuple of provider slugs.                    |
| `CATALOG`   | Frozen array of every catalog entry.               |
| `BY_ID`     | Frozen `Record<ModelId, CatalogEntry>` lookup.     |
| `DEFAULTS`  | Frozen per-model defaults.                         |

### Subpath imports (tree-shaking)

```ts
import { MODEL_IDS } from "modelparams/model-ids"; // types-only consumers
import { DEFAULTS } from "modelparams/defaults"; // just defaults
import { CATALOG } from "modelparams/data"; // full runtime catalog
```

## How it's built

- Source of truth: the YAML catalog at [github.com/mnfst/modelparams.dev/tree/main/models](https://github.com/mnfst/modelparams.dev/tree/main/models).
- A codegen script reads the catalog through the same Zod schema the website uses and emits four `.ts` files (`model-ids`, `params-by-id`, `defaults`, `data`).
- Every catalog change on `main` auto-publishes a new version. Removed params bump major; everything else is patch. Provenance is signed via npm OIDC.

## Versioning

| Catalog change                                                 | npm bump  |
| -------------------------------------------------------------- | --------- |
| Parameter removed from a still-existing model                  | **major** |
| Anything else (new model, new param, range or default changed) | **patch** |
| No semantic change                                             | skipped   |

Pin `^x.y.z` to get non-breaking updates as new models and parameters land.

## License

MIT
