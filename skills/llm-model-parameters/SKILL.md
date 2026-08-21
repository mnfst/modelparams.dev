---
name: llm-model-parameters
description: Look up and validate the parameters an LLM accepts before calling it — temperature, top_p, top_k, reasoning_effort, thinking budgets — including which combinations a provider rejects. Use when writing or reviewing code that calls an LLM API with non-default parameters, when picking a model by the knobs it exposes, when building a model settings UI or an LLM router, or when debugging a provider 400 such as "unsupported parameter", "unrecognized request argument", "unsupported value", or "temperature and top_p cannot both be specified". Backed by the open modelparams.dev catalog.
---

# LLM model parameters

Model parameters are not uniform and not stable. `gpt-5.5` has no `temperature`.
Claude Opus 4.7 dropped it. Anthropic rejects `top_p` unless `temperature` is 1.
Reasoning models reject sampling knobs entirely. Training data goes stale on all
of this, so **look it up rather than recalling it.**

## When to use this skill

- Writing or editing code that passes parameters to an LLM API.
- Debugging a 400 from a provider, or output that ignores a parameter you set.
- Choosing a model based on a knob you need (a thinking budget, a seed, `top_k`).
- Building a model picker, settings UI, eval harness, gateway, or router.
- Reviewing a diff that hardcodes parameters across multiple models.

## Pick an access path

| Situation                            | Use                                                  |
| ------------------------------------ | ---------------------------------------------------- |
| An MCP server is available to you    | The `modelparams` MCP tools — no network, no parsing |
| Any agent or shell, one-off question | The HTTP API (below)                                 |
| You're writing TypeScript that ships | The `modelparams` npm package — compile-time safety  |

### MCP tools

If the `modelparams` MCP server is connected, prefer these — they need no network access:

- `validate_model_params` — the one to reach for. Give it a model and a params
  object; it returns what's wrong and a corrected `safeParams` payload.
- `get_model_params` — every parameter for one model, with types, ranges,
  defaults, and conditional rules.
- `list_models` — find the exact catalog id, filtered by provider or substring.
- `list_provider_models` — every model one provider serves, with its wire id and
  parameter surface. Reach for it when the provider is fixed and the model is not.

Not connected? Install it:

```bash
claude mcp add --transport http modelparams https://modelparams.dev/mcp
codex mcp add modelparams --url https://modelparams.dev/mcp
```

### HTTP API

CORS-enabled, no key, no rate limit.

```bash
# Validate a request before you send it — the highest-value call
curl -s https://modelparams.dev/api/v1/validate \
  -H 'Content-Type: application/json' \
  -d '{"model":"anthropic/claude-3-opus-20240229","params":{"temperature":0.5,"top_p":0.9}}'
```

```jsonc
{
  "model": "anthropic/claude-3-opus-20240229",
  "valid": false,
  "issues": [
    {
      "path": "top_p",
      "code": "not_applicable", // or unknown_parameter | invalid_value
      "message": "top_p does not apply when temperature ≠ 1",
      "conflictsWith": ["temperature"],
    },
  ],
  "safeParams": { "temperature": 0.5 }, // always safe to send as-is
}
```

Other endpoints:

```bash
curl https://modelparams.dev/api/v1/models/openai/gpt-5.5.json    # one model's params
curl https://modelparams.dev/api/v1/models/anthropic/claude-opus-4-7.json
curl https://modelparams.dev/api/v1/models.json                   # full catalog
curl https://modelparams.dev/api/v1/index.json                    # endpoint map + live count
```

Ids are always `provider/model`; subscription contracts append `-subscription`.
A bare slug is refused with the qualified ids to retry with. Alternatively pass
`baseUrl` (what the SDK is configured with) and the exact wire model string.

### npm package

```bash
npm i modelparams
```

```ts
import { dropUnsupported, parseParams, type ParamsOf } from "modelparams";

// Compile-time: passing a parameter the model doesn't have won't build.
const params: ParamsOf<"openai/gpt-4.1"> = { max_tokens: 1024, temperature: 0.7 };

// Runtime, for untrusted input — enforces conflicts too.
const result = parseParams("openai/gpt-4.1", req.body.params);
if (!result.success) return res.status(422).json({ issues: result.issues });

// Or strip whatever won't fly and proceed (like LiteLLM's drop_params,
// extended to conditional conflicts).
const { params: safe, dropped } = dropUnsupported("openai/gpt-5.5", userParams);
```

## Workflow: writing code that calls an LLM

1. Resolve the exact catalog id (`list_models`, or `/api/v1/models.json`).
2. Fetch the parameter list for that model — do not assume it matches a sibling
   model or an earlier version.
3. Validate the params object you intend to send.
4. If invalid, use `safeParams` or fix the call. Do not silently drop the
   parameter without telling the user which one went and why.

## Workflow: debugging a provider 400

1. Extract the model id and the params object from the failing call.
2. Run `validate_model_params` (or POST to `/api/v1/validate`).
3. Match the `code`:
   - `unknown_parameter` — the model has no such knob. Remove it.
   - `invalid_value` — right knob, out of range or not in the enum.
   - `not_applicable` — the knob exists but conflicts with another value in the
     same request. Check `conflictsWith`; change one or drop the other.
4. If validation passes, the problem is not parameter shape — look at auth,
   the endpoint, or the message payload instead.

## Conditional rules

The catalog's distinguishing data is _applicability_: when a parameter is
accepted, expressed in terms of the others in the same request.

- `appliesOnlyWhen: { only: {...} }` — accepted only while that condition holds.
- `appliesOnlyWhen: { except: {...} }` — rejected while that condition holds.

A parameter you never set still counts, because the provider applies its
default. Setting `thinking.budget_tokens` without `thinking.type: "enabled"` is
a silent no-op, and validation reports it.

## Gotchas worth checking explicitly

- Reasoning models (GPT-5.x, o-series, Claude with thinking on) reject or ignore
  `temperature` and `top_p`. This is the single most common source of 400s.
- Anthropic rejects `top_p` alongside a non-default `temperature`.
- OpenAI reasoning models take `max_completion_tokens`, not `max_tokens`.
- Google nests everything under `generationConfig.*`.
- Some providers accept an unsupported parameter and ignore it silently — no
  error, just drifting evals. Validate rather than trusting a 200.
- API-key and subscription contracts can expose different parameters for the
  same model. Check the `-subscription` variant if that's how you authenticate.

## Contributing a correction

The catalog is open and community-maintained. If a model is missing or a
parameter is wrong, the data is YAML at
`models/{provider}/{model}.yaml` in
[github.com/mnfst/modelparams.dev](https://github.com/mnfst/modelparams.dev) —
one file, one PR, CI validates it against the published JSON Schema.
