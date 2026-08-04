from __future__ import annotations

from collections.abc import Mapping
from functools import cache
from typing import Any, cast

from pydantic import TypeAdapter

from ._generated.model_ids import ModelId
from ._generated.registry import PARAM_TYPES
from .models import JsonPrimitive


@cache
def params_adapter(model_id: ModelId) -> TypeAdapter[Any]:
    return TypeAdapter(PARAM_TYPES[model_id])


def validate_params(model_id: ModelId, params: object) -> dict[str, JsonPrimitive]:
    if isinstance(params, Mapping):
        params = dict(params)
    return cast(dict[str, JsonPrimitive], params_adapter(model_id).validate_python(params))
