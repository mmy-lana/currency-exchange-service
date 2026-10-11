import json
import logging
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_EVEN
from typing import List, Tuple
import redis.asyncio as redis
from app.models.schemas import HistoricalRatesModel, HistoricalRatePointModel, TimeRange
from app.services.aggregator import UpstreamRateAggregator

logger = logging.getLogger("currency-exchange.cache-manager")

RATE_QUANT = Decimal("0.0001")
PCT_QUANT = Decimal("0.01")


class HistoricalCacheManager:
    """Historical timeseries cache backed by a genuine upstream authority.

    Integrity invariant: this manager never fabricates market data. When the
    cache is cold, observations are fetched from the upstream provider. If the
    provider is unreachable, an error is raised and the route responds with a
    structured 503 HISTORICAL_DATA_UNAVAILABLE envelope for client retry.
    All metric arithmetic is performed with decimal.Decimal under banker's
    rounding, then emitted at fixed 4-decimal (1 for percentages) precision.
    """

    def __init__(self, redis_client: redis.Redis, aggregator: UpstreamRateAggregator | None = None):
        self.redis = redis_client
        self.aggregator = aggregator or UpstreamRateAggregator()

    async def get_historical_series(
        self,
        base: str,
        target: str,
        range_str: str
    ) -> Tuple[HistoricalRatesModel, bool]:
        if base == target:
            return self._build_identity_series(base, target, range_str), True

        cache_key = f"rates:timeseries:{base}:{target}:{range_str}"
        cached_data = await self.redis.get(cache_key)

        if cached_data:
            parsed = json.loads(cached_data.decode("utf-8"))
            return HistoricalRatesModel.model_validate(parsed), True

        try:
            observations = await self.aggregator.fetch_historical_timeseries(base, target, range_str)
        except RuntimeError:
            # No fabricated fallback: propagate a structured failure so the
            # route can emit HISTORICAL_DATA_UNAVAILABLE and the UI can offer retry.
            logger.exception("Upstream historical fetch failed for %s/%s (%s)", base, target, range_str)
            raise

        model = self._build_model(base, target, range_str, observations)
        await self.redis.setex(cache_key, 3600, json.dumps(model.model_dump()))
        return model, False

    def _build_identity_series(self, base: str, target: str, range_str: str) -> HistoricalRatesModel:
        """DEF-02: base == target is always an exact flat 1.0000 series.

        Short-circuits without any upstream call: an identity pair carries no
        market information, so fabricating nothing and querying vendors for it
        would only produce upstream HTTP errors.
        """
        days_map = {"7D": 7, "30D": 30, "90D": 90, "1Y": 365}
        days = days_map.get(range_str, 30)
        now = int(datetime.now(timezone.utc).timestamp())
        points = [
            HistoricalRatePointModel(
                date=datetime.fromtimestamp(now - (i * 86400), tz=timezone.utc).date().isoformat(),
                timestamp=(now - (i * 86400)) * 1000,
                rate=1.0,
            )
            for i in range(days, -1, -1)
        ]
        return HistoricalRatesModel(
            base=base,
            target=target,
            range=TimeRange(range_str),
            min_rate=1.0,
            max_rate=1.0,
            average_rate=1.0,
            percentage_change=0.0,
            points=points,
        )

    def _build_model(
        self,
        base: str,
        target: str,
        range_str: str,
        observations: List[Tuple[str, str]]
    ) -> HistoricalRatesModel:
        points: List[HistoricalRatePointModel] = []
        for date_str, raw_rate in observations:
            day_timestamp = int(datetime.fromisoformat(date_str)
                                .replace(tzinfo=timezone.utc).timestamp() * 1000)
            quantized_rate = Decimal(raw_rate).quantize(RATE_QUANT, rounding=ROUND_HALF_EVEN)
            points.append(HistoricalRatePointModel(
                date=date_str,
                timestamp=day_timestamp,
                rate=float(quantized_rate),
            ))

        rates = [Decimal(p.rate) for p in points]
        min_rate = min(rates)
        max_rate = max(rates)
        avg_rate = (sum(rates) / Decimal(len(rates))).quantize(RATE_QUANT, rounding=ROUND_HALF_EVEN)
        pct_change = (
            (rates[-1] - rates[0]) / rates[0] * Decimal(100)
        ).quantize(PCT_QUANT, rounding=ROUND_HALF_EVEN)

        return HistoricalRatesModel(
            base=base,
            target=target,
            range=TimeRange(range_str),
            min_rate=float(min_rate),
            max_rate=float(max_rate),
            average_rate=float(avg_rate),
            percentage_change=float(pct_change),
            points=points
        )
