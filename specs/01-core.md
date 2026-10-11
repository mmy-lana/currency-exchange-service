# Core System Specifications

### Global TypeScript Interfaces (`packages/shared-types/src/index.ts`)

```typescript
/**
 * Canonical single source of truth for frontend currency validation.
 * Invariant: Backend CurrencyCode enum and frontend SUPPORTED_CURRENCIES must be kept
 * in sync manually until an automated codegen pipeline is introduced.
 */
export const SUPPORTED_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'AUD',
  'CAD',
  'CHF',
  'CNY',
  'HKD',
  'NZD',
  'SGD',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export interface CurrencyMetadata {
  code: SupportedCurrency;
  name: string;
  symbol: string;
  flagCode: string;
  decimalPlaces: number;
}

export type ExchangeRateMap = Partial<Record<SupportedCurrency, number>>;

export interface LiveRatesPayload {
  base: SupportedCurrency;
  /** Epoch timestamp in milliseconds */
  timestamp: number;
  rates: ExchangeRateMap;
}

export interface ConversionRequest {
  from: SupportedCurrency;
  to: SupportedCurrency;
  amount: number;
}

export interface ConversionResult {
  from: SupportedCurrency;
  to: SupportedCurrency;
  amount: number;
  convertedAmount: number;
  unitRate: number;
  inverseUnitRate: number;
  /** Epoch timestamp in milliseconds */
  timestamp: number;
}

export type TimeRangeOption = '7D' | '30D' | '90D' | '1Y';

export interface HistoricalRatePoint {
  date: string;
  timestamp: number;
  rate: number;
}

export interface HistoricalRatesPayload {
  base: SupportedCurrency;
  target: SupportedCurrency;
  range: TimeRangeOption;
  minRate: number;
  maxRate: number;
  averageRate: number;
  percentageChange: number;
  points: HistoricalRatePoint[];
}

export interface ApiEnvelopeMeta {
  timestamp: string;
  cached: boolean;
  cacheTtlSeconds: number;
}

export interface ApiEnvelopeError {
  code: string;
  message: string;
  field?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiEnvelopeError | null;
  meta: ApiEnvelopeMeta;
}
```

### Backend Pydantic Schemas (`apps/api/app/models/schemas.py`)

```python
from enum import Enum
from typing import Dict, List, Optional, Generic, TypeVar
from pydantic import BaseModel, Field

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
    amount: float = Field(..., gt=0.0, description="Amount to be converted, strictly positive.")

    model_config = {
        "populate_by_name": True
    }


class LiveRatesModel(BaseModel):
    base: CurrencyCode
    timestamp: int
    rates: Dict[CurrencyCode, float]


class ConversionResultModel(BaseModel):
    from_currency: CurrencyCode = Field(..., alias="from")
    to_currency: CurrencyCode = Field(..., alias="to")
    amount: float
    converted_amount: float = Field(..., serialization_alias="convertedAmount")
    unit_rate: float = Field(..., serialization_alias="unitRate")
    inverse_unit_rate: float = Field(..., serialization_alias="inverseUnitRate")
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
    min_rate: float = Field(..., serialization_alias="minRate")
    max_rate: float = Field(..., serialization_alias="maxRate")
    average_rate: float = Field(..., serialization_alias="averageRate")
    percentage_change: float = Field(..., serialization_alias="percentageChange")
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
```

### Redis Data Structures & Key Layouts

| Key Structure | Redis Type | TTL | Description |
|---|---|---|---|
| `rates:latest:{BASE}` | Hash | 120 seconds | Fields: `{TARGET}`: `rate_float`, `_updated_at`: `epoch_ms` |
| `rates:timeseries:{BASE}:{TARGET}:{RANGE}` | String (JSON) | 3600 seconds | Serialized array of `HistoricalRatePointModel` |
| `lock:sync:{BASE}` | String | 15 seconds | Distributed lock acquiring external sync token |
| `ratelimit:{IP}` | String (Integer) | 60 seconds | Sliding counter for IP-based API rate limiting |
| `queue:deadletter:sync` | List | Indefinite | Diagnostic queue for failed ingestion payloads |
| `metadata:currencies` | String (JSON) | 86400 seconds | Static catalog of supported currencies, flags, and decimal bounds |

### Core Infrastructure Foundations

#### Configuration Model (`apps/api/app/core/config.py`)
```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    REDIS_URL: str = "redis://redis:6379/0"
    API_V1_PREFIX: str = "/v1"
    PROJECT_NAME: str = "Currency & Exchange Microservice"
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    CORS_ORIGIN_REGEX: str = r"^https:\/\/.*\.vercel\.app$"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
```

#### Shared Redis Client Provider (`apps/api/app/core/redis.py`)
```python
import redis.asyncio as aioredis
from app.core.config import settings

# INVARIANT: decode_responses=False is required monorepo-wide.
# Consumers must call .decode("utf-8") manually. Do not change.
_pool: aioredis.Redis | None = None


async def get_redis_client() -> aioredis.Redis:
    global _pool
    if _pool is None:
        _pool = aioredis.from_url(settings.REDIS_URL, decode_responses=False)
    return _pool
```

#### Backend Application Entry Point (`apps/api/app/main.py`)
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routes import convert, historical

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_methods=["GET"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-Client-Timestamp"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
)

app.include_router(convert.router, prefix=settings.API_V1_PREFIX)
app.include_router(historical.router, prefix=settings.API_V1_PREFIX)
```

#### Shared Web Utilities (`apps/web/src/lib/utils.ts`)
```typescript
import { SupportedCurrency } from '@currency-exchange/shared-types';

export const INPUT_DEBOUNCE_MS = 300;

export function assertRate(
  map: Partial<Record<SupportedCurrency, number>>,
  currency: SupportedCurrency
): number {
  const rate = map[currency];
  if (rate === undefined) {
    throw new Error(`Exchange rate unavailable for currency: ${currency}`);
  }
  return rate;
}
```

#### Shared Fetch Client (`apps/web/src/lib/api-client.ts`)
```typescript
import { ApiResponse } from '@currency-exchange/shared-types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function fetchJson<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorMessage = `HTTP request failed: ${response.status} ${response.statusText}`;
    try {
      const errorEnvelope = (await response.json()) as ApiResponse<null>;
      if (errorEnvelope.error?.message) {
        errorMessage = errorEnvelope.error.message;
      }
    } catch {
      // Retain fallback HTTP status text if response is non-JSON
    }
    throw new Error(errorMessage);
  }

  const envelope = (await response.json()) as ApiResponse<T>;
  if (!envelope.success || envelope.data === null || envelope.data === undefined) {
    throw new Error(envelope.error?.message || 'Unexpected service envelope error.');
  }

  return envelope.data;
}
```

#### Vite Environment Declarations (`apps/web/src/vite-env.d.ts`)
```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

#### Backend Requirements (`apps/api/requirements.txt`)
```
fastapi
uvicorn
pydantic
pydantic-settings
httpx
redis
```

#### Monorepo Pipeline Configuration (`turbo.json`)
```json
{
  "$schema": "https://turbo.build/schema.json",
  "// turbo": "Requires turbo@latest (v2+ syntax). tasks key is canonical.",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "lint": {
      "dependsOn": ["^lint"],
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^typecheck"],
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```
