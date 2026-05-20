# Model Parameters Convention

The Model Parameters Schema (MPS) convention is the JSON/YAML shape used by
modelparameters.dev to describe the request parameters available for a specific
provider, auth type, and model.

This catalog is metadata. It describes knobs a consumer can put into an outbound
model request, such as `temperature`, `top_p`, `max_tokens`, or
`thinking.type`. It does not describe API transport capabilities, proxy behavior,
authentication flows, endpoint compatibility, pricing, or UI control types.

The public runtime sources are:

- `https://modelparameters.dev/api/v1/models.json`
- `https://modelparameters.dev/api/v1/schema.json`
- `https://modelparameters.dev/api/v1/models/{provider}/{api|subscription}/{model}.json`

## Catalog Entry

Each entry describes exactly one provider/auth/model tuple and its available
parameters.

```json
{
  "provider": "anthropic",
  "authType": "api_key",
  "model": "claude-haiku-4-5",
  "params": [
    {
      "path": "top_p",
      "type": "number",
      "label": "Top P",
      "description": "Controls nucleus sampling by limiting generation to tokens whose cumulative probability reaches this value.",
      "default": 1,
      "range": { "min": 0, "max": 1, "step": 0.01 },
      "group": "sampling",
      "applicability": {
        "except": [{ "thinking.type": ["adaptive", "enabled"] }, { "temperature": { "not": 1 } }]
      }
    }
  ]
}
```

Conventions:

- `provider`, `authType`, and `model` identify exactly one model route.
- `provider` is a kebab-case slug.
- `model` is the provider-native model id without path separators. It may
  contain dots or colons when the upstream model id does.
- `authType` is `api_key` or `subscription`.
- Source files live under `models/{provider}/api/{model}.yaml` for API-key
  routes and `models/{provider}/subscription/{model}.yaml` for subscription
  routes. The `api` folder maps to `authType: "api_key"`.
- `params` is the non-empty list of parameters for that exact route.
- `path` is a snake_case dot path into stored params and outbound request params.
- `stream` is reserved for API-level streaming capability metadata and is not a
  valid MPS parameter path.
- `type` is the semantic data type, not a UI control kind.
- `label` is user-facing copy.
- `description` explains the raw provider parameter.
- `default` is the provider default to display when known.
- `values` is required for `enum` and is allowed only for finite choices.
- `range` describes numeric bounds and optional step.
- `group` is a semantic grouping for ordering and display.
- `applicability` is optional. Omitted means always available.

## Parameter Scope

MPS entries should describe only parameters the user or consumer can configure
for the selected provider/auth/model tuple.

For `authType: api_key`, list parameters from the official provider API
reference. Do not invent request fields the upstream API does not accept.

For `authType: subscription`, list user-facing toggles and presets the consumer
can actually set. Skip implementation details needed only by the subscription
adapter.

Do not model transport or platform capabilities as parameters. Examples that do
not belong in `params`:

- streaming support
- proxy or passthrough behavior
- OAuth or API key setup details
- fallback behavior
- pricing and rate limits
- UI-only control metadata

## Applicability

`applicability` controls whether a parameter is available for the current draft
or request params.

The convention uses two top-level keys:

- `only`: the parameter is available only when the rule matches.
- `except`: the parameter is unavailable when the rule matches.

Use at least one of `only` or `except`.

## Rule Shape

A rule is either:

- one non-empty match object
- a non-empty array of match objects

Array rules use OR semantics. A single match object uses AND semantics.

```json
{
  "except": [{ "thinking.type": ["adaptive", "enabled"] }, { "temperature": { "not": 1 } }]
}
```

This means: disable the parameter when `thinking.type` is `adaptive` or
`enabled`, or when `temperature` exists and is not `1`.

## Match Values

Each match key is a snake_case dot path. Each match value uses one of:

- JSON primitive: string, number, boolean, or null
- non-empty array of JSON primitives
- `{ "not": <primitive or non-empty primitive array> }`

Examples:

```json
{ "thinking.type": "enabled" }
```

```json
{ "thinking.type": ["adaptive", "enabled"] }
```

```json
{ "temperature": { "not": 1 } }
```

## Evaluation Semantics

Consumers evaluate rules against the current params object after dot-path
expansion.

For a normal match:

- primitive value matches by JSON equality
- array value matches if any primitive item equals the actual value
- missing paths do not match

For `{ "not": value }`:

- missing paths do not match
- present paths match when the actual value is not equal to `value`

For a parameter spec:

1. If `only` is present and does not match, the parameter is unavailable.
2. If `except` is present and matches, the parameter is unavailable.
3. Otherwise the parameter is available.

## Adding A New Rule

Prefer expressing provider behavior with the existing `applicability` syntax.

Introduce new convention syntax only when a provider rule cannot be represented
with:

- exact match
- one-of match
- negated match
- OR of match objects
- AND within one match object

When extending the language, update this document and the generated catalog
format together.
