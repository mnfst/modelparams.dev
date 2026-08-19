# modelparams-mcp

> **MCP server for the [modelparams.dev](https://modelparams.dev) catalog.** Let an agent check which parameters a model accepts — before it calls one.

```bash
claude mcp add --transport http modelparams https://modelparams.dev/mcp
```

Model parameters aren't uniform and don't hold still. `gpt-5.5` has no `temperature`. Claude Opus 4.7 dropped it. Anthropic rejects `top_p` unless `temperature` is 1. Reasoning models reject sampling knobs outright. An agent writing LLM code from training data gets this wrong constantly, and the failure is either a 400 or — worse — a silently ignored parameter and drifting evals.

This server gives the agent a way to look it up instead.

## Install

The server is hosted at `https://modelparams.dev/mcp`, over Streamable HTTP. Nothing to install, and it answers from the
catalog the site is serving.

**Claude Code**

```bash
claude mcp add --transport http modelparams https://modelparams.dev/mcp
```

**Codex**

```bash
codex mcp add modelparams --url https://modelparams.dev/mcp
```

**Any client with a JSON config** (Claude Desktop, Cursor, Windsurf, Zed, …)

```json
{
  "mcpServers": {
    "modelparams": {
      "type": "http",
      "url": "https://modelparams.dev/mcp"
    }
  }
}
```

> **This package is not published to npm.** The code here runs the same four tools over stdio, for offline use and for
> clients that cannot take a URL, and `npm run build --workspace=modelparams-mcp` builds it from a checkout. Until it is
> published, the hosted endpoint is the only way to install it.

## Tools

### `validate_model_params`

The one that earns its keep. Give it a model and the params you're about to send:

```json
{ "model": "claude-3-opus-20240229", "params": { "temperature": 0.5, "top_p": 0.9 } }
```

```json
{
  "model": "anthropic/claude-3-opus-20240229",
  "valid": false,
  "summary": "1 parameter(s) would be rejected or silently ignored by anthropic/claude-3-opus-20240229.",
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

`safeParams` is always a payload that would pass validation, so an agent that doesn't want to reason about the rules can take it and move on.

Issue codes: `unknown_parameter` (no such knob on this model), `invalid_value` (out of range or not in the enum), `not_applicable` (the knob exists but conflicts with another value in the same request).

### `get_model_params`

Every parameter for one model — type, range, enum values, default, and the conditional rules that gate it.

### `list_models`

Model ids, filtered by provider or substring. Use it to resolve the exact catalog id.

### `find_models_supporting`

Which models expose a given parameter — `reasoning_effort`, `thinking.budget_tokens`, `top_k`. Answers "which models let me set X". Returns near-miss suggestions when nothing matches, since callers usually have the provider's spelling rather than the catalog's.

## Model ids

Ids are `provider/model`. Subscription contracts append `-subscription`, because the same model often exposes different parameters via an API key than via a subscription. Every tool also accepts a bare model slug when only one provider publishes it.

## Placeholders in `requestModel`

A `requestModel` containing `{scope}` needs one substitution before you send it. Bedrock reaches most newer models only through a cross-region inference profile, and the profile id is the model id behind a geography prefix, so `"{scope}.anthropic.claude-sonnet-4-5-20250929-v1:0"` is `us.anthropic.…` in Virginia, `eu.anthropic.…` in Frankfurt, and `global.anthropic.…` when you want AWS to pick. Valid scopes today: `us`, `eu`, `apac`, `jp`, `au`, `ca`, `sa`, `global`. A `requestModel` with no placeholder is already complete.

## Wire formats

One entry documents one wire format, so `validate_model_params` answers for the surface that entry describes and no other. This matters when a host serves two: `bedrock/*` documents Amazon Bedrock's `Converse` API — `inferenceConfig.maxTokens`, vendor extras under `additionalModelRequestFields` — which is what `ConverseCommand` in `@aws-sdk/client-bedrock-runtime` sends. It does **not** describe `InvokeModel` with native per-vendor bodies (`max_tokens`, top-level `thinking`), which is what `AnthropicBedrock` from `@anthropic-ai/bedrock-sdk` sends. Validate against the surface your code actually calls; the full support table is in the [catalog README](https://github.com/mnfst/modelparams.dev#api-surfaces).

## Related

- **[modelparams](https://www.npmjs.com/package/modelparams)** — the TypeScript package: `ParamsOf<Id>` for compile-time safety, `parseParams` and `dropUnsupported` at runtime.
- **[HTTP API](https://modelparams.dev/api)** — same data as CORS-enabled static JSON, plus `POST /api/v1/validate`.
- **[Catalog](https://modelparams.dev)** — browse it, or open a PR against the YAML.

## How it's built

The catalog is compiled in at publish time from the YAML source of truth at [github.com/mnfst/modelparams.dev](https://github.com/mnfst/modelparams.dev/tree/main/models). No runtime fetch, no cache to invalidate — update the package to get new models.

The hosted endpoint is rebuilt with the site on every catalog change, so it always answers from the current catalog. A local build of this package pins an exact [`modelparams`](https://www.npmjs.com/package/modelparams) dependency instead, and answers from whichever catalog version that pin resolves.

## License

MIT
