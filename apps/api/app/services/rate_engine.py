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
