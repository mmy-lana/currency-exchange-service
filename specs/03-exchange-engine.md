# Live Exchange Rates & Conversion Engine

### State Lifecycle (Zustand: `apps/web/src/store/exchange-store.ts`)

```typescript
import { create } from 'zustand';
import { SupportedCurrency, ConversionResult } from '@currency-exchange/shared-types';

interface ExchangeStoreState {
  fromCurrency: SupportedCurrency;
  toCurrency: SupportedCurrency;
  amount: string;
  conversionResult: ConversionResult | null;
  isLoading: boolean;
  errorMessage: string | null;
  lastUpdated: number | null;
  setFromCurrency: (currency: SupportedCurrency) => void;
  setToCurrency: (currency: SupportedCurrency) => void;
  setAmount: (amount: string) => void;
  swapCurrencies: () => void;
  setConversionResult: (result: ConversionResult | null) => void;
  setIsLoading: (loading: boolean) => void;
  setErrorMessage: (msg: string | null) => void;
}

export const useExchangeStore = create<ExchangeStoreState>((set, get) => ({
  fromCurrency: 'USD',
  toCurrency: 'EUR',
  amount: '1000',
  conversionResult: null,
  isLoading: false,
  errorMessage: null,
  lastUpdated: null,

  setFromCurrency: (fromCurrency) => {
    if (fromCurrency === get().toCurrency) {
      set({ toCurrency: get().fromCurrency, fromCurrency });
    } else {
      set({ fromCurrency });
    }
  },

  setToCurrency: (toCurrency) => {
    if (toCurrency === get().fromCurrency) {
      set({ fromCurrency: get().toCurrency, toCurrency });
    } else {
      set({ toCurrency });
    }
  },

  setAmount: (amount) => set({ amount }),

  swapCurrencies: () =>
    set((state) => ({
      fromCurrency: state.toCurrency,
      toCurrency: state.fromCurrency,
      conversionResult: null,
      errorMessage: null,
    })),

  setConversionResult: (conversionResult) =>
    set({
      conversionResult,
      lastUpdated: conversionResult ? conversionResult.timestamp : null,
      errorMessage: null,
    }),

  setIsLoading: (isLoading) => set({ isLoading }),
  setErrorMessage: (errorMessage) => set({ errorMessage, isLoading: false }),
}));
```

### Rate Computation Core Engine (`apps/api/app/services/rate_engine.py`)

```python
import time
from typing import Tuple
import redis.asyncio as redis
from app.services.aggregator import UpstreamRateAggregator

# Dependency invariant: aggregator -> schemas; rate_engine -> aggregator + schemas; routes -> rate_engine.
# Never import rate_engine inside aggregator to avoid circular dependency deadlocks.


class RateEngine:
    def __init__(self, redis_client: redis.Redis, aggregator: UpstreamRateAggregator):
        self.redis = redis_client
        self.anchor_currency = "USD"
        self.aggregator = aggregator

    async def get_rate_pair(self, from_currency: str, to_currency: str) -> Tuple[float, float, bool]:
        if from_currency == to_currency:
            return 1.0, 1.0, True

        cache_key = f"rates:latest:{self.anchor_currency}"
        rates_map = await self.redis.hgetall(cache_key)
        is_cached = True

        if not rates_map:
            # Fallback inline recovery if cache is cold
            fresh_rates = await self.aggregator.fetch_latest_rates()
            cache_payload = {k: str(v) for k, v in fresh_rates.items()}
            cache_payload["_updated_at"] = str(int(time.time() * 1000))
            await self.redis.hset(cache_key, mapping=cache_payload)
            await self.redis.expire(cache_key, 120)
            rates_map = await self.redis.hgetall(cache_key)
            is_cached = False

        rates = {k.decode("utf-8"): float(v.decode("utf-8")) for k, v in rates_map.items() if not k.startswith(b"_")}
        rates[self.anchor_currency] = 1.0

        if from_currency not in rates or to_currency not in rates:
            raise ValueError(f"Unsupported conversion pair: {from_currency} to {to_currency}")

        rate_from_usd = rates[from_currency]
        rate_to_usd = rates[to_currency]

        unit_rate = rate_to_usd / rate_from_usd
        inverse_rate = rate_from_usd / rate_to_usd

        return round(unit_rate, 8), round(inverse_rate, 8), is_cached
```

### FastAPI Route Handlers (`apps/api/app/routes/convert.py`)

```python
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.redis import get_redis_client
from app.models.schemas import (
    BaseApiResponse,
    ConversionResultModel,
    CurrencyCode,
    ApiEnvelopeMetaModel
)
from app.services.aggregator import UpstreamRateAggregator
from app.services.rate_engine import RateEngine

router = APIRouter(prefix="/v1", tags=["Exchange Engine"])

# Note: _aggregator_singleton is safe at module scope only while UpstreamRateAggregator.__init__
# remains stateless. Move initialization to a FastAPI lifespan handler if stateful connection pools are added.
_aggregator_singleton = UpstreamRateAggregator()


def get_aggregator() -> UpstreamRateAggregator:
    return _aggregator_singleton


@router.get("/convert", response_model=BaseApiResponse[ConversionResultModel])
async def convert_currency(
    from_currency: CurrencyCode = Query(..., alias="from"),
    to_currency: CurrencyCode = Query(..., alias="to"),
    amount: float = Query(..., gt=0.0),
    redis=Depends(get_redis_client),
    aggregator: UpstreamRateAggregator = Depends(get_aggregator)
):
    engine = RateEngine(redis, aggregator)

    try:
        unit_rate, inverse_rate, is_cached = await engine.get_rate_pair(
            from_currency=from_currency.value,
            to_currency=to_currency.value
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=422,
            detail={"code": "UNSUPPORTED_CURRENCY_PAIR", "message": str(val_err)}
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "UPSTREAM_RATE_UNAVAILABLE", "message": str(exc)}
        )

    converted_amount = round(amount * unit_rate, 6)
    timestamp_now = int(time.time() * 1000)

    result_payload = ConversionResultModel(
        from=from_currency,
        to=to_currency,
        amount=amount,
        converted_amount=converted_amount,
        unit_rate=unit_rate,
        inverse_unit_rate=inverse_rate,
        timestamp=timestamp_now
    )

    return BaseApiResponse[ConversionResultModel](
        success=True,
        data=result_payload,
        error=None,
        meta=ApiEnvelopeMetaModel(
            timestamp=datetime.now(timezone.utc).isoformat(),
            cached=is_cached,
            cache_ttl_seconds=120 if is_cached else 0
        )
    )
```

### Frontend Exchange Hook (`apps/web/src/hooks/use-exchange-rate.ts`)

```typescript
import { useEffect, useRef } from 'react';
import { ConversionResult } from '@currency-exchange/shared-types';
import { useExchangeStore } from '../store/exchange-store';
import { fetchJson } from '../lib/api-client';
import { INPUT_DEBOUNCE_MS } from '../lib/utils';

export function useExchangeRate() {
  const {
    fromCurrency,
    toCurrency,
    amount,
    setConversionResult,
    setIsLoading,
    setErrorMessage,
  } = useExchangeStore();

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setConversionResult(null);
      setIsLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);

    const debounceTimer = setTimeout(async () => {
      try {
        const result = await fetchJson<ConversionResult>(
          `/v1/convert?from=${fromCurrency}&to=${toCurrency}&amount=${numericAmount}`,
          { signal: controller.signal }
        );
        setConversionResult(result);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const message = err instanceof Error ? err.message : 'Conversion query failed';
        setErrorMessage(message);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, INPUT_DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
    // Zustand setters are referentially stable across renders; omitted to prevent redundant poll executions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCurrency, toCurrency, amount]);
}
```
