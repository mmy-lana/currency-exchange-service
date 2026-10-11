from decimal import Decimal
from enum import Enum
from typing import Dict, List, Optional, Generic, TypeVar
from pydantic import AliasChoices, BaseModel, Field

T = TypeVar("T")


class CurrencyCode(str, Enum):
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"
    JPY = "JPY"
    AUD = "AUD"
    CAD = "CAD"
    CHF = "CHF"
    CNY = "CNY"
    HKD = "HKD"
    NZD = "NZD"
    SGD = "SGD"


class TimeRange(str, Enum):
    RANGE_7D = "7D"
    RANGE_30D = "30D"
    RANGE_90D = "90D"
    RANGE_1Y = "1Y"


class ConversionQueryModel(BaseModel):
    from_currency: CurrencyCode = Field(..., alias="from")
    to_currency: CurrencyCode = Field(..., alias="to")
    amount: Decimal = Field(..., gt=Decimal("0.0"), description="Amount to be converted, strictly positive.")

    model_config = {
        "populate_by_name": True
    }


class LiveRatesModel(BaseModel):
    base: CurrencyCode
    timestamp: int
    rates: Dict[CurrencyCode, float]


class ConversionResultModel(BaseModel):
    # Financial integrity invariant: monetary values and unit rates are serialized
    # as exact string-quantized decimal representations, never IEEE-754 floats.
    from_currency: CurrencyCode = Field(..., alias="from")
    to_currency: CurrencyCode = Field(..., alias="to")
    amount: Decimal
    converted_amount: str = Field(..., serialization_alias="convertedAmount")
    unit_rate: str = Field(..., serialization_alias="unitRate")
    inverse_unit_rate: str = Field(..., serialization_alias="inverseUnitRate")
    timestamp: int

    model_config = {
        "populate_by_name": True,
        "serialize_by_alias": True
    }


class HistoricalRatePointModel(BaseModel):
    date: str
    timestamp: int
    rate: float


class HistoricalRatesModel(BaseModel):
    base: CurrencyCode
    target: CurrencyCode
    range: TimeRange
    min_rate: float = Field(..., validation_alias=AliasChoices("min_rate", "minRate"), serialization_alias="minRate")
    max_rate: float = Field(..., validation_alias=AliasChoices("max_rate", "maxRate"), serialization_alias="maxRate")
    average_rate: float = Field(..., validation_alias=AliasChoices("average_rate", "averageRate"), serialization_alias="averageRate")
    percentage_change: float = Field(..., validation_alias=AliasChoices("percentage_change", "percentageChange"), serialization_alias="percentageChange")
    points: List[HistoricalRatePointModel]

    model_config = {
        "populate_by_name": True,
        "serialize_by_alias": True
    }


class ApiEnvelopeMetaModel(BaseModel):
    timestamp: str
    cached: bool
    cache_ttl_seconds: int = Field(..., serialization_alias="cacheTtlSeconds")

    model_config = {
        "populate_by_name": True,
        "serialize_by_alias": True
    }


class ApiEnvelopeErrorModel(BaseModel):
    code: str
    message: str
    field: Optional[str] = None


class BaseApiResponse(BaseModel, Generic[T]):
    # Note: The data field is validated by route-level response_model= declaration, not by this generic container.
    success: bool
    data: Optional[T] = None
    error: Optional[ApiEnvelopeErrorModel] = None
    meta: ApiEnvelopeMetaModel

    model_config = {
        "populate_by_name": True,
        "serialize_by_alias": True,
        "arbitrary_types_allowed": True
    }
