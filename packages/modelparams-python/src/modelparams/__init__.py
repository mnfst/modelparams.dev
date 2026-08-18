from importlib import metadata

from ._generated.model_ids import MODEL_IDS, PROVIDERS, ModelId, Provider
from .catalog import (
    BY_ID,
    CATALOG,
    DEFAULTS,
    get_defaults,
    get_model,
    get_param,
    list_all_models,
    list_models,
)
from .models import (
    Applicability,
    ApplicabilityCondition,
    CatalogEntry,
    JsonPrimitive,
    Parameter,
    ParamGroup,
    ParamRange,
    ParamType,
)
from .validation import params_adapter, validate_params


def _package_version() -> str:
    try:
        return metadata.version("modelparams")
    except metadata.PackageNotFoundError:
        return "0+unknown"


__version__ = _package_version()

__all__ = [
    "BY_ID",
    "CATALOG",
    "DEFAULTS",
    "MODEL_IDS",
    "PROVIDERS",
    "Applicability",
    "ApplicabilityCondition",
    "CatalogEntry",
    "JsonPrimitive",
    "ModelId",
    "Parameter",
    "ParamGroup",
    "ParamRange",
    "ParamType",
    "Provider",
    "__version__",
    "get_defaults",
    "get_model",
    "get_param",
    "list_all_models",
    "list_models",
    "params_adapter",
    "validate_params",
]
