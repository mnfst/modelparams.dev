from __future__ import annotations

from typing import Literal, TypeAlias

from pydantic import BaseModel, ConfigDict, Field

JsonPrimitive: TypeAlias = str | int | float | bool | None
JsonNumber: TypeAlias = int | float
AuthType: TypeAlias = Literal["api_key", "subscription"]
LifecycleStatus: TypeAlias = Literal["active", "deprecated", "retired"]
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


class CatalogEntry(FrozenModel):
    provider: str
    auth_type: AuthType = Field(alias="authType")
    model: str
    # Exact wire string when the host's native id differs from the catalog
    # slug (pathed ids: accounts/fireworks/models/kimi-k3, openai/gpt-oss-20b).
    wire_id: str | None = Field(alias="wireId", default=None)
    status: LifecycleStatus | None = None
    replacement: str | None = None
    shutdown_on: str | None = Field(alias="shutdownOn", default=None)
    params: tuple[Parameter, ...]
