<div align="center">
  <img width="500" height="91" alt="mps 1" src="https://github.com/user-attachments/assets/5316cfd4-1005-48e5-850c-3e7e9e2f74f1" />
</div>
<hr>

# modelparams.dev

> An open, community-maintained catalog of LLM API parameters.

[![npm version](https://img.shields.io/npm/v/modelparams.svg)](https://www.npmjs.com/package/modelparams)
[![npm downloads](https://img.shields.io/npm/dm/modelparams.svg)](https://www.npmjs.com/package/modelparams)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Every API parameter each AI model accepts, in one place: `temperature`, `top_p`, `max_tokens` and the rest of the request body, with defaults, ranges and gating conditions. Not weight counts — see [model parameters vs. API parameters](https://modelparams.dev/model-parameters-vs-api-parameters). Inspired by [models.dev](https://github.com/anomalyco/models.dev); we use it at [Manifest](https://manifest.build/).

## TypeScript

```bash
npm install modelparams
```

`ParamsOf<Id>` is the exact set of parameters a model accepts. Pass one it doesn't, and your code won't compile.

```ts
import type { ParamsOf } from "modelparams";
import OpenAI from "openai";

const params: ParamsOf<"openai/gpt-4.1"> = {
  max_tokens: 1024,
  temperature: 0.7,
  // top_k: 40, // won't compile: gpt-4.1 has no top_k
};

await new OpenAI().chat.completions.create({ model: "gpt-4.1", messages, ...params });
```

Defaults, runtime validation, and the helper APIs are in the [package README](packages/modelparams/README.md).

## Python

```bash
pip install modelparams
```

Generated `TypedDict` definitions provide model-specific autocomplete and static checking, while
Pydantic validates untrusted values at runtime:

```python
from modelparams import validate_params
from modelparams.types.openai import Gpt_4_1Params

params: Gpt_4_1Params = {"max_tokens": 1024, "temperature": 0.7}
validated = validate_params("openai/gpt-4.1", params)
```

Defaults, catalog helpers, and validation details are in the
[Python package README](packages/modelparams-python/README.md).

## API

Prefer raw JSON?

```
curl https://modelparams.dev/api/v1/models.json
curl https://modelparams.dev/api/v1/params/gpt-5.5.json
```

Schema at `https://modelparams.dev/api/v1/schema.json`, per the [Model Parameters convention](docs/model-parameters-schema.md).

### Validate a request

POST the parameters you're about to send. You get back what's wrong — including combinations the provider rejects — and a corrected payload.

```bash
curl -s https://modelparams.dev/api/v1/validate \
  -H 'Content-Type: application/json' \
  -d '{"model":"claude-3-opus-20240229","params":{"temperature":0.5,"top_p":0.9}}'
```

```json
{
  "valid": false,
  "issues": [
    {
      "path": "top_p",
      "code": "not_applicable",
      "message": "top_p does not apply when temperature ≠ 1",
      "conflictsWith": ["temperature"]
    }
  ],
  "safeParams": { "temperature": 0.5 }
}
```

## Agents

```bash
npx -y modelparams-mcp              # MCP server: 4 tools, stdio, no network needed
npx skills add mnfst/modelparams.dev # the companion agent skill
```

The MCP server exposes `validate_model_params`, `get_model_params`, `list_models`, and `find_models_supporting`. Details in the [package README](packages/modelparams-mcp/README.md). There's also [llms.txt](https://modelparams.dev/llms.txt) if you'd rather just point an agent at a URL.

## One model, many providers

A model appears in the catalog under **every provider that serves it**, not just the vendor that made it — because each host accepts a different set of parameters for the same weights. That difference is exactly what this catalog exists to record, and it is real. Probed live on 2026-08-18:

|                    | `moonshot/kimi-k3`                                                | `fireworks/kimi-k3`                 |
| ------------------ | ----------------------------------------------------------------- | ----------------------------------- |
| Wire id to send    | `kimi-k3`                                                         | `accounts/fireworks/models/kimi-k3` |
| `temperature: 1.8` | ✗ 400 — `invalid temperature: only 0.6 is allowed for this model` | ✓ accepted (range 0–2)              |
| `top_k: 40`        | not declared                                                      | ✓ accepted                          |
| Thinking control   | `thinking.type`, `reasoning_effort`                               | not exposed                         |

Three consequences of this convention:

- **`requestModel`** — when a host's native id can't serve as the catalog slug (Fireworks' pathed ids, Groq's `openai/gpt-oss-20b`), the entry keeps a clean slug and carries the exact wire string in `requestModel`. Every API response and MCP tool returns it; send that string, not the slug.
- **Bare slugs can be ambiguous.** Ask for `kimi-k3` without a provider and the API answers `ambiguous_model` with the qualified ids instead of guessing — any single answer would be wrong for callers on the other host. Providerless `/api/v1/params/<slug>.json` files exist only for unambiguous slugs.
- **Each entry is probed against its own host.** `fireworks/kimi-k3` was verified against Fireworks' endpoint, not Moonshot's docs.

## Parameters that stop working

Providers change gateway validation **in place, on live model ids, without a version bump**. The catalog records this with a per-parameter `deprecated` flag instead of deleting the parameter — deleting would erase the answer to "why did my working code break?".

The proving case: `anthropic/claude-sonnet-5` accepted `temperature` on 2026-07-11 (verified live). By 2026-08-17 the same request had become a hard error:

```bash
# temperature 0.5 — worked in July, now:
# 400 {"error": {"message": "`temperature` is deprecated for this model."}}
# temperature 1 (the default) — still 200 OK
```

That's `behavior: default-only` — only the default survives. The other behaviors are `rejected` (any use fails) and `ignored` (accepted, no effect — the worst one, because nothing tells you). A nightly drift sweep re-probes the catalog so these flips get caught and dated:

```yaml
deprecated:
  behavior: default-only
  since: "2026-08-17"
  note: The API now rejects non-default values; only the default value 1 is accepted.
```

## Adding a model

Drop a YAML file in `models/<provider>/`, open a PR, and CI validates it against the schema. Details in [CONTRIBUTING.md](CONTRIBUTING.md). Can't open a PR? [File an issue](https://github.com/mnfst/modelparams.dev/issues/new/choose) with a link to the docs.

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # → dist/
npm run validate     # check every YAML
npm test             # site tests, including the /api/v1/validate function
npm test --workspaces # + every published package
npm run codegen:python # regenerate the Python package catalog and types
```

## License

MIT
