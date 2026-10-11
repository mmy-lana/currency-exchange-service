import asyncio
import time
import uuid
from decimal import Decimal, ROUND_HALF_EVEN, localcontext
from typing import Dict, Tuple
import redis.asyncio as redis
from app.services.aggregator import UpstreamRateAggregator

# Dependency invariant: aggregator -> schemas; rate_engine -> aggregator + schemas; routes -> rate_engine.
# Never import rate_engine inside aggregator to avoid circular dependency deadlocks.

RATE_QUANT = Decimal("0.00000001")
IDENTITY_RATE = Decimal("1.00000000")
RATE_CONTEXT_PREC = 28

# Atomic single-flight lock release: identical contract to the sync worker.
# The lock is deleted only when its stored value still matches the acquiring
# token, so a worker whose lease outlived the TTL can never delete a lock
# re-acquired by another process.
RELEASE_LOCK_SCRIPT = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
"""


class RateEngine:
    """Deterministic cross-rate engine.

    Financial integrity invariants:
    - All arithmetic uses decimal.Decimal; IEEE-754 floats are never accepted.
    - Rates are computed under ROUND_HALF_EVEN to 8 decimal places.
    - Cache misses are guarded by a single-flight distributed lock so that
      concurrent cold-cache requests never flood upstream providers.
    """

    def __init__(self, redis_client: redis.Redis, aggregator: UpstreamRateAggregator):
        self.redis = redis_client
        self.anchor_currency = "USD"
        self.aggregator = aggregator
        self.single_flight_lock_ttl = 10
        self.single_flight_wait_seconds = 2.0
        self.single_flight_poll_interval = 0.05

    def _lock_key(self) -> str:
        return f"lock:fetch:{self.anchor_currency}"

    async def _load_fresh_rates(self) -> Tuple[Dict[str, str], bool]:
        """Populate the rate cache under the single-flight lock.

        Returns (rates_payload, is_cached). Concurrent waiters re-read the
        cache populated by the lock owner instead of calling upstream.
        """
        lock_key = self._lock_key()
        token = str(uuid.uuid4())
        deadline = time.monotonic() + self.single_flight_wait_seconds

        acquired = bool(await self.redis.set(lock_key, token, nx=True, ex=self.single_flight_lock_ttl))
        if not acquired:
            # Another worker is fetching. Poll briefly for cache population.
            while time.monotonic() < deadline:
                await asyncio.sleep(self.single_flight_poll_interval)
                rates_map = await self.redis.hgetall(f"rates:latest:{self.anchor_currency}")
                if rates_map:
                    is_cached = True
                    return (
                        {k.decode("utf-8"): v.decode("utf-8") for k, v in rates_map.items()},
                        is_cached,
                    )
            # Waiter timed out; fall through and attempt to become the leader.

        try:
            rates_map = await self.redis.hgetall(f"rates:latest:{self.anchor_currency}")
            if not rates_map:
                fresh_rates = await self.aggregator.fetch_latest_rates()
                cache_payload = {k: str(Decimal(str(v))) for k, v in fresh_rates.items()}
                cache_payload["_updated_at"] = str(int(time.time() * 1000))
                async with self.redis.pipeline(transaction=True) as pipe:
                    pipe.hset(f"rates:latest:{self.anchor_currency}", mapping=cache_payload)
                    pipe.expire(f"rates:latest:{self.anchor_currency}", 120)
                    await pipe.execute()
                rates_map = await self.redis.hgetall(f"rates:latest:{self.anchor_currency}")
                is_cached = False
            else:
                is_cached = True
            return (
                {k.decode("utf-8"): v.decode("utf-8") for k, v in rates_map.items()},
                is_cached,
            )
        finally:
            if acquired:
                await self.redis.eval(RELEASE_LOCK_SCRIPT, 1, lock_key, token)

    async def get_rate_pair(self, from_currency: str, to_currency: str) -> Tuple[str, str, bool]:
        """Return quantized (unit_rate, inverse_rate, is_cached) as exact strings."""
        with localcontext() as ctx:
            ctx.prec = RATE_CONTEXT_PREC
            ctx.rounding = ROUND_HALF_EVEN

            if from_currency == to_currency:
                # FIN-01: identity conversion is an exact 1:1 rate, never the
                # quantum epsilon.
                return str(IDENTITY_RATE), str(IDENTITY_RATE), True

            payload, is_cached = await self._load_fresh_rates()

            rates: Dict[str, Decimal] = {}
            for key, raw_value in payload.items():
                if key.startswith("_"):
                    continue
                rates[key] = Decimal(raw_value)
            rates[self.anchor_currency] = Decimal(1)

            if from_currency not in rates or to_currency not in rates:
                raise ValueError(f"Unsupported conversion pair: {from_currency} to {to_currency}")

            rate_from_usd = rates[from_currency]
            rate_to_usd = rates[to_currency]

            unit_rate = (rate_to_usd / rate_from_usd).quantize(RATE_QUANT, rounding=ROUND_HALF_EVEN)
            inverse_rate = (rate_from_usd / rate_to_usd).quantize(RATE_QUANT, rounding=ROUND_HALF_EVEN)

            return str(unit_rate), str(inverse_rate), is_cached

    async def get_unit_rate(self, from_currency: str, to_currency: str) -> Tuple[Decimal, bool]:
        """Convenience accessor returning the unit rate as a Decimal."""
        unit_rate_str, _, is_cached = await self.get_rate_pair(from_currency, to_currency)
        return Decimal(unit_rate_str), is_cached
