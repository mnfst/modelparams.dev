from importlib import metadata
from types import MappingProxyType

import pytest
from pydantic import ValidationError

import modelparams
from modelparams import (
    BY_ID,
    CATALOG,
    DEFAULTS,
    MODEL_IDS,
    PROVIDERS,
    get_defaults,
    get_model,
    get_param,
    list_all_models,
    list_models,
)
from modelparams._generated.registry import PARAM_TYPES

HAIKU = "anthropic/claude-haiku-4-5-20251001"


def test_version_falls_back_when_distribution_metadata_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def missing_version(_distribution_name: str) -> str:
        raise metadata.PackageNotFoundError

    monkeypatch.setattr(modelparams.metadata, "version", missing_version)
    assert modelparams._package_version() == "0+unknown"


def test_generated_catalog_indexes_are_complete() -> None:
    assert CATALOG
    assert len(CATALOG) == len(MODEL_IDS) == len(BY_ID) == len(DEFAULTS)
    assert set(BY_ID) == set(MODEL_IDS)
    assert set(PARAM_TYPES) == set(MODEL_IDS)
    assert PROVIDERS


def test_get_model_returns_frozen_pythonic_metadata() -> None:
    model = get_model(HAIKU)
    assert model.provider == "anthropic"
    assert model.auth_type == "api_key"
    assert model.model == "claude-haiku-4-5-20251001"
    assert model.status == "active"
    assert model.params
    with pytest.raises(ValidationError):
        model.model = "changed"


def test_defaults_are_immutable_and_do_not_include_missing_values() -> None:
    defaults = get_defaults(HAIKU)
    assert isinstance(defaults, MappingProxyType)
    assert defaults["max_tokens"] == 4096
    assert defaults["thinking.type"] == "disabled"
    with pytest.raises(TypeError):
        defaults["max_tokens"] = 1  # type: ignore[index]
    assert (
        get_defaults("alibaba/qwen-flash")["extra_body.chat_template_kwargs.enable_thinking"]
        is True
    )


def test_model_listing_and_lookup_helpers() -> None:
    assert list_models() is MODEL_IDS
    anthropic = list_models("anthropic")
    assert anthropic
    assert all(model_id.startswith("anthropic/") for model_id in anthropic)
    assert get_param(HAIKU, "thinking.type") is not None
    assert get_param(HAIKU, "not.a.parameter") is None
    assert list_all_models() is CATALOG


def test_applicability_aliases_are_preserved() -> None:
    parameter = get_param("anthropic/claude-3-5-sonnet-latest", "temperature")
    assert parameter is not None
    assert parameter.applicability is not None
    assert parameter.applicability.except_ is not None
    dumped = parameter.applicability.model_dump(by_alias=True)
    assert "except" in dumped
    assert "except_" not in dumped
