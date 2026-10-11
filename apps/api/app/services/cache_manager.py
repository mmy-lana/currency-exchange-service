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
