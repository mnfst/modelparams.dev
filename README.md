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
curl https://modelparams.dev/api/v1/models/openai/gpt-5.5.json
```

Schema at `https://modelparams.dev/api/v1/schema.json`, per the [Model Parameters convention](docs/model-parameters-schema.md).

### Validate a request

POST the parameters you're about to send. You get back what's wrong — including combinations the provider rejects — and a corrected payload.

```bash
curl -s https://modelparams.dev/api/v1/validate \
  -H 'Content-Type: application/json' \
  -d '{"model":"anthropic/claude-3-opus-20240229","params":{"temperature":0.5,"top_p":0.9}}'
```

Or pass what your SDK is actually configured with — the base URL and the wire model string:

```bash
curl -s https://modelparams.dev/api/v1/validate \
  -H 'Content-Type: application/json' \
  -d '{"baseUrl":"https://api.fireworks.ai/inference/v1","model":"accounts/fireworks/models/kimi-k3","params":{"top_k":40}}'
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

The same model accepts different parameters on each host that serves it. The catalog has one entry per host, each probed against that host's own endpoint.

|                    | `moonshot/kimi-k3` | `fireworks/kimi-k3`                 |
| ------------------ | ------------------ | ----------------------------------- |
| Wire id            | `kimi-k3`          | `accounts/fireworks/models/kimi-k3` |
| `temperature: 1.8` | ✗ 400              | ✓                                   |
| `top_k`            | ✗                  | ✓                                   |
| Thinking control   | ✓                  | ✗                                   |

- **`requestModel`** — the exact string to send when it differs from the catalog slug. Every API response and MCP tool returns it.
- **Provider is mandatory** — `kimi-k3` alone is refused with both qualified ids to retry with; the catalog never guesses a host.

## API surfaces

One entry documents one wire format.

| Surface                                                                                               | Status |
| ----------------------------------------------------------------------------------------------------- | ------ |
| OpenAI Chat Completions — openai, deepseek, xai, mistral, moonshot, alibaba, z-ai, groq, fireworks, … | ✅     |
| Anthropic Messages                                                                                    | ✅     |
| Google `generateContent`                                                                              | ✅     |
| Amazon Bedrock `Converse` — every `bedrock/*` entry                                                   | ✅     |
| Subscription plans (`-subscription` entries)                                                          | ✅     |
| Amazon Bedrock `InvokeModel` (native per-vendor bodies)                                               | ❌     |
| MiniMax native endpoint                                                                               | ❌     |
| OpenAI Responses API                                                                                  | ❌     |
| Google Interactions API                                                                               | ❌     |
| xAI native SDK                                                                                        | ❌     |

Embeddings, audio, image, and batch APIs are out of scope. Missing a surface? [Open an issue](https://github.com/mnfst/modelparams.dev/issues/new/choose) or a PR.

Bedrock is the sharpest case, because one host serves both surfaces and the SDK you pick decides which. `ConverseCommand` (`@aws-sdk/client-bedrock-runtime`) takes `inferenceConfig.maxTokens` and puts vendor extras in `additionalModelRequestFields` — that is what `bedrock/*` documents. `AnthropicBedrock` (`@anthropic-ai/bedrock-sdk`) calls `InvokeModel` with the native Anthropic body (`max_tokens`, top-level `thinking`) instead, so these entries do not describe it. Same model, same key, two vocabularies.

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
