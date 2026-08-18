from typing import Any, cast

import pytest
from pydantic import ValidationError

from modelparams import MODEL_IDS, get_defaults, params_adapter, validate_params

GPT = "openai/gpt-4.1"
HAIKU = "anthropic/claude-haiku-4-5-20251001"


def error_types(error: ValidationError) -> set[str]:
    return {str(issue["type"]) for issue in error.errors()}


def test_accepts_valid_and_empty_params() -> None:
    assert validate_params(GPT, {"temperature": 0.5, "max_tokens": 100}) == {
        "temperature": 0.5,
        "max_tokens": 100,
    }
    assert validate_params(GPT, {}) == {}


def test_accepts_catalog_defaults_mapping() -> None:
    defaults = get_defaults(GPT)
    assert validate_params(GPT, defaults) == dict(defaults)


def test_rejects_unknown_keys_and_collects_errors() -> None:
    with pytest.raises(ValidationError) as caught:
        validate_params(GPT, {"temperature": 5, "nope": 1})
    assert {issue["loc"] for issue in caught.value.errors()} == {("temperature",), ("nope",)}
    assert error_types(caught.value) == {"less_than_equal", "extra_forbidden"}


@pytest.mark.parametrize(
    ("params", "expected_type"),
    [
        ({"temperature": "0.5"}, "float_type"),
        ({"temperature": True}, "float_type"),
        ({"max_tokens": 1.5}, "int_type"),
        ({"max_tokens": "10"}, "int_type"),
    ],
)
def test_strict_validation_rejects_coercion(params: dict[str, object], expected_type: str) -> None:
    with pytest.raises(ValidationError) as caught:
        validate_params(GPT, params)
    assert expected_type in error_types(caught.value)


def test_enforces_ranges_and_enum_literals() -> None:
    with pytest.raises(ValidationError) as high:
        validate_params(GPT, {"temperature": 2.1})
    assert "less_than_equal" in error_types(high.value)

    with pytest.raises(ValidationError) as low:
        validate_params(GPT, {"temperature": -0.1})
    assert "greater_than_equal" in error_types(low.value)

    assert validate_params(HAIKU, {"thinking.type": "enabled"}) == {"thinking.type": "enabled"}
    with pytest.raises(ValidationError) as enum_error:
        validate_params(HAIKU, {"thinking.type": "off"})
    assert "literal_error" in error_types(enum_error.value)


def test_preserves_dot_paths_without_expansion() -> None:
    params = {
        "thinking.type": "enabled",
        "thinking.budget_tokens": 4096,
    }
    assert validate_params(HAIKU, params) == params


def test_does_not_inject_defaults_or_enforce_step_or_applicability() -> None:
    assert validate_params(HAIKU, {}) == {}
    assert validate_params(GPT, {"temperature": 0.55}) == {"temperature": 0.55}
    contradictory = {"thinking.type": "enabled", "temperature": 0.5}
    assert validate_params("anthropic/claude-sonnet-4-6", contradictory) == contradictory


def test_adapter_is_cached_and_unknown_model_raises_key_error() -> None:
    assert params_adapter(GPT) is params_adapter(GPT)
    with pytest.raises(KeyError):
        params_adapter(cast(Any, "openai/not-a-model"))


def test_every_generated_adapter_accepts_its_catalog_defaults() -> None:
    for model_id in MODEL_IDS:
        validated = params_adapter(model_id).validate_python(dict(get_defaults(model_id)))
        assert validated == dict(get_defaults(model_id))


@pytest.mark.parametrize("params", [None, 42, "params", [1, 2]])
def test_rejects_non_dictionary_inputs(params: object) -> None:
    with pytest.raises(ValidationError):
        validate_params(GPT, params)
