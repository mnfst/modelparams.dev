from __future__ import annotations

from typing import Literal, TypeAlias

from pydantic import BaseModel, ConfigDict, Field

JsonPrimitive: TypeAlias = str | int | float | bool | None
JsonNumber: TypeAlias = int | float
AuthType: TypeAlias = Literal["api_key", "subscription"]
ParamType: TypeAlias = Literal["boolean", "enum", "integer", "number", "string"]
ParamGroup: TypeAlias = Literal[
    "generation_length",
    "sampling",
    "reasoning",
    "tooling",
    "output_format",
    "observability",
    "provider_metadata",
]


class FrozenModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", populate_by_name=True)


class ParamRange(FrozenModel):
    min: JsonNumber | None = None
    max: JsonNumber | None = None
    step: JsonNumber | None = None


class ApplicabilityCondition(FrozenModel):
    not_: JsonPrimitive | tuple[JsonPrimitive, ...] = Field(alias="not")


ApplicabilityValue: TypeAlias = JsonPrimitive | tuple[JsonPrimitive, ...] | ApplicabilityCondition
ApplicabilityRule: TypeAlias = dict[str, ApplicabilityValue]
ApplicabilityRuleSet: TypeAlias = ApplicabilityRule | tuple[ApplicabilityRule, ...]


class Applicability(FrozenModel):
    only: ApplicabilityRuleSet | None = None
    except_: ApplicabilityRuleSet | None = Field(default=None, alias="except")


class ParamDeprecation(FrozenModel):
    """The provider stopped honoring the param for this model id (see the site schema)."""

    behavior: Literal["rejected", "ignored", "default-only"]
    since: str | None = None
    note: str | None = None


class Parameter(FrozenModel):
    path: str
    label: str
    description: str
    group: ParamGroup
    type: ParamType
    default: JsonPrimitive = None
    range: ParamRange | None = None
    values: tuple[JsonPrimitive, ...] | None = None
    applicability: Applicability | None = None
    deprecated: ParamDeprecation | None = None


class CatalogEntry(FrozenModel):
    provider: str
    auth_type: AuthType = Field(alias="authType")
    model: str
    params: tuple[Parameter, ...]
