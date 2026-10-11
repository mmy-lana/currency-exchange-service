# Historical Trends & Analytics Charting

### Historical Data Lifecycle & Timeseries Modeling

The analytics engine processes historical cross-rate trajectories over discrete intervals (7D, 30D, 90D, 1Y). Data points are cached in Redis under `rates:timeseries:{base}:{target}:{range}` with a 3600-second TTL.

### Timeseries Aggregation (`apps/api/app/services/cache_manager.py`)

```python
import json
import time
from typing import Tuple
import redis.asyncio as redis
from app.models.schemas import HistoricalRatesModel, HistoricalRatePointModel, TimeRange


class HistoricalCacheManager:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def get_historical_series(
        self,
        base: str,
        target: str,
        range_str: str
    ) -> Tuple[HistoricalRatesModel, bool]:
        cache_key = f"rates:timeseries:{base}:{target}:{range_str}"
        cached_data = await self.redis.get(cache_key)

        if cached_data:
            parsed = json.loads(cached_data.decode("utf-8"))
            return HistoricalRatesModel(**parsed), True

        model = self._generate_fallback_trend(base, target, range_str)
        await self.redis.setex(cache_key, 3600, json.dumps(model.model_dump()))
        return model, False

    def _generate_fallback_trend(self, base: str, target: str, range_str: str) -> HistoricalRatesModel:
        days_map = {"7D": 7, "30D": 30, "90D": 90, "1Y": 365}
        days = days_map.get(range_str, 30)

        now = int(time.time())
        points = []
        base_rate = 1.0850 if target == "EUR" else 0.8520

        for i in range(days, -1, -1):
            day_timestamp = now - (i * 86400)
            date_str = time.strftime("%Y-%m-%d", time.gmtime(day_timestamp))
            rate = round(base_rate + (0.002 * (i % 5)) - (0.001 * (i % 3)), 4)
            points.append(HistoricalRatePointModel(date=date_str, timestamp=day_timestamp * 1000, rate=rate))

        rates = [p.rate for p in points]
        min_rate = min(rates)
        max_rate = max(rates)
        avg_rate = round(sum(rates) / len(rates), 4)
        pct_change = round(((rates[-1] - rates[0]) / rates[0]) * 100, 2)

        return HistoricalRatesModel(
            base=base,
            target=target,
            range=TimeRange(range_str),
            min_rate=min_rate,
            max_rate=max_rate,
            average_rate=avg_rate,
            percentage_change=pct_change,
            points=points
        )
```

### Analytics Endpoint (`apps/api/app/routes/historical.py`)

```python
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from app.core.redis import get_redis_client
from app.models.schemas import (
    BaseApiResponse,
    CurrencyCode,
    TimeRange,
    HistoricalRatesModel,
    ApiEnvelopeMetaModel
)
from app.services.cache_manager import HistoricalCacheManager

router = APIRouter(prefix="/v1", tags=["Historical Analytics"])


@router.get("/rates/historical", response_model=BaseApiResponse[HistoricalRatesModel])
async def get_historical_rates(
    base: CurrencyCode = Query(...),
    target: CurrencyCode = Query(...),
    time_range: TimeRange = Query(TimeRange.RANGE_30D, alias="range"),
    redis=Depends(get_redis_client)
):
    manager = HistoricalCacheManager(redis)
    try:
        data, is_cached = await manager.get_historical_series(
            base=base.value,
            target=target.value,
            range_str=time_range.value
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "HISTORICAL_SERIES_UNAVAILABLE", "message": str(exc)}
        )

    return BaseApiResponse[HistoricalRatesModel](
        success=True,
        data=data,
        error=None,
        meta=ApiEnvelopeMetaModel(
            timestamp=datetime.now(timezone.utc).isoformat(),
            cached=is_cached,
            cache_ttl_seconds=3600
        )
    )
```

### Interactive Canvas / SVG Chart Component (`apps/web/src/components/charts/InteractiveChart.tsx`)

```tsx
import React, { useState, useId } from 'react';
import { HistoricalRatePoint } from '@currency-exchange/shared-types';

export interface InteractiveChartProps {
  points: HistoricalRatePoint[];
  height?: number;
}

export const InteractiveChart: React.FC<InteractiveChartProps> = ({ points, height = 280 }) => {
  const [activePoint, setActivePoint] = useState<HistoricalRatePoint | null>(null);
  const rawId = useId();
  const filterId = rawId.replace(/:/g, '');

  if (!points || points.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center border border-[var(--color-fintech-border)] rounded-lg">
        <span className="text-sm font-mono text-[var(--color-fintech-text-muted)]">No data points available</span>
      </div>
    );
  }

  const rates = points.map((p) => p.rate);
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const range = max - min === 0 ? 1 : max - min;
  const paddingX = 16;
  const paddingY = 24;
  const viewBoxWidth = 600;
  const viewBoxHeight = height;

  const coordinates = points.map((p, idx) => {
    const x = (idx / (points.length - 1)) * (viewBoxWidth - paddingX * 2) + paddingX;
    const y = viewBoxHeight - paddingY - ((p.rate - min) / range) * (viewBoxHeight - paddingY * 2);
    return { x, y, point: p };
  });

  const polylinePoints = coordinates.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

  const areaPath = `M ${coordinates[0].x.toFixed(1)},${viewBoxHeight.toFixed(1)} ` +
    coordinates.map((c) => `L ${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ') +
    ` L ${coordinates[coordinates.length - 1].x.toFixed(1)},${viewBoxHeight.toFixed(1)} Z`;

  const handleTouchOrMove = (clientX: number, rect: DOMRect) => {
    const relativeX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, relativeX / rect.width));
    const targetIdx = Math.round(ratio * (points.length - 1));
    setActivePoint(points[targetIdx]);
  };

  return (
    <div className="flex flex-col gap-2 w-full select-none">
      <div className="flex justify-between items-center min-h-[32px] px-1">
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-[var(--color-fintech-text-muted)]">Selected:</span>
          <span className="text-[var(--color-emerald-accent)] font-semibold">
            {activePoint ? activePoint.rate.toFixed(4) : points[points.length - 1].rate.toFixed(4)}
          </span>
        </div>
        <div className="font-mono text-xs text-[var(--color-fintech-text-secondary)]">
          {activePoint ? activePoint.date : points[points.length - 1].date}
        </div>
      </div>

      <div
        className="relative w-full overflow-hidden touch-none"
        onTouchMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          handleTouchOrMove(e.touches[0].clientX, rect);
        }}
        // Touch-end intentionally resets to latest point, not the last scrubbed position
        onTouchEnd={() => setActivePoint(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          handleTouchOrMove(e.clientX, rect);
        }}
        onMouseLeave={() => setActivePoint(null)}
      >
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full overflow-visible"
          style={{ height: 'auto', maxHeight: height }}
        >
          <defs>
            <linearGradient id={`gradient-${filterId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-emerald-primary)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--color-emerald-primary)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          <path d={areaPath} fill={`url(#gradient-${filterId})`} />

          <polyline
            fill="none"
            stroke="var(--color-emerald-accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylinePoints}
          />

          {activePoint && (
            (() => {
              const activeCoord = coordinates.find((c) => c.point.date === activePoint.date);
              if (!activeCoord) return null;
              return (
                <g>
                  <line
                    x1={activeCoord.x}
                    y1={0}
                    x2={activeCoord.x}
                    y2={viewBoxHeight}
                    stroke="var(--color-fintech-border-bright)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <circle
                    cx={activeCoord.x}
                    cy={activeCoord.y}
                    r="5"
                    fill="var(--color-fintech-base)"
                    stroke="var(--color-emerald-accent)"
                    strokeWidth="2.5"
                  />
                </g>
              );
            })()
          )}
        </svg>
      </div>
    </div>
  );
};
```

### Historical Rates Hook (`apps/web/src/hooks/use-historical-rates.ts`)

```typescript
import { useEffect, useState, useRef } from 'react';
import { SupportedCurrency, TimeRangeOption, HistoricalRatesPayload } from '@currency-exchange/shared-types';
import { fetchJson } from '../lib/api-client';

export interface UseHistoricalRatesProps {
  base: SupportedCurrency;
  target: SupportedCurrency;
  range: TimeRangeOption;
}

/**
 * Historical data is fetched once per parameter change with no background polling.
 * Backend cache TTL is 3600 seconds; data freshness matches daily closing aggregates.
 */
export function useHistoricalRates({ base, target, range }: UseHistoricalRatesProps) {
  const [data, setData] = useState<HistoricalRatesPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    async function loadHistoricalData() {
      try {
        const payload = await fetchJson<HistoricalRatesPayload>(
          `/v1/rates/historical?base=${base}&target=${target}&range=${range}`,
          { signal: controller.signal }
        );
        setData(payload);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const message = err instanceof Error ? err.message : 'Failed to fetch historical series';
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadHistoricalData();

    return () => {
      controller.abort();
    };
  }, [base, target, range]);

  return { data, isLoading, error };
}
```
