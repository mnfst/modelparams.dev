from __future__ import annotations

from collections.abc import Mapping
from importlib.resources import files
from types import MappingProxyType
from typing import cast

from pydantic import TypeAdapter

from ._generated.model_ids import MODEL_IDS, ModelId, Provider
from .models import CatalogEntry, JsonPrimitive, Parameter

_catalog_bytes = files("modelparams._generated").joinpath("catalog.json").read_bytes()
CATALOG = TypeAdapter(tuple[CatalogEntry, ...]).validate_json(_catalog_bytes)


def _entry_id(entry: CatalogEntry) -> str:
    suffix = "" if entry.auth_type == "api_key" else "-subscription"
    return f"{entry.provider}/{entry.model}{suffix}"


BY_ID: Mapping[ModelId, CatalogEntry] = MappingProxyType(
    cast(dict[ModelId, CatalogEntry], {_entry_id(entry): entry for entry in CATALOG})
)
DEFAULTS: Mapping[ModelId, Mapping[str, JsonPrimitive]] = MappingProxyType(
    {
        model_id: MappingProxyType(
            {
                parameter.path: parameter.default
                for parameter in entry.params
                if "default" in parameter.model_fields_set
            }
        )
        for model_id, entry in BY_ID.items()
    }
)


def get_model(model_id: ModelId) -> CatalogEntry:
    return BY_ID[model_id]


def get_defaults(model_id: ModelId) -> Mapping[str, JsonPrimitive]:
    return DEFAULTS[model_id]


def list_models(provider: Provider | None = None) -> tuple[ModelId, ...]:
    if provider is None:
        return MODEL_IDS
    prefix = f"{provider}/"
    return tuple(model_id for model_id in MODEL_IDS if model_id.startswith(prefix))


def get_param(model_id: ModelId, path: str) -> Parameter | None:
    return next((parameter for parameter in BY_ID[model_id].params if parameter.path == path), None)


def list_all_models() -> tuple[CatalogEntry, ...]:
    return CATALOG
