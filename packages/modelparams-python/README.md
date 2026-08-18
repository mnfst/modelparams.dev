# modelparams

Typed model parameters for Python, generated from the open
[modelparams.dev](https://modelparams.dev) catalog.

```bash
pip install modelparams
```

## Typed request parameters

Generated `TypedDict` definitions provide autocomplete and static errors for unsupported keys,
incorrect value types, and invalid enum values:

```python
from modelparams import validate_params
from modelparams.types.openai import Gpt_4_1Params

params: Gpt_4_1Params = {
    "max_tokens": 1024,
    "temperature": 0.7,
}

validated = validate_params("openai/gpt-4.1", params)
```

`validate_params` uses a cached strict Pydantic adapter. It returns a provider-keyed dictionary or
raises `pydantic.ValidationError` for unknown parameters, coercions, invalid enum values, or values
outside the catalog range.

```python
from openai import OpenAI

OpenAI().chat.completions.create(model="gpt-4.1", messages=messages, **validated)
```

Provider-specific dot paths remain literal dictionary keys:

```python
from modelparams.types.anthropic import Claude_Haiku_4_5_20251001Params

params: Claude_Haiku_4_5_20251001Params = {
    "thinking.type": "enabled",
    "thinking.budget_tokens": 4096,
}
```

## Catalog helpers

```python
from modelparams import get_defaults, get_model, get_param, list_models

model = get_model("anthropic/claude-haiku-4-5-20251001")
print(model.auth_type, model.params)

defaults = get_defaults("anthropic/claude-haiku-4-5-20251001")
thinking = get_param("anthropic/claude-haiku-4-5-20251001", "thinking.type")
anthropic_models = list_models("anthropic")
```

The catalog is bundled with the package. No network request is made at runtime.

## Development

From the repository root:

```bash
npm run codegen:python
uv sync --project packages/modelparams-python --extra dev
uv run --project packages/modelparams-python pytest packages/modelparams-python/tests
```

Generated catalog and type files are committed and verified in CI. Python releases use independent
`modelparams-py@x.y.z` tags and publish to PyPI through the repository's trusted-publisher workflow.
