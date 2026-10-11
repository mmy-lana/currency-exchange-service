import logging
import time
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_EVEN
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

logger = logging.getLogger("currency-exchange.convert")

router = APIRouter(tags=["Exchange Engine"])

# Note: _aggregator_singleton is safe at module scope only while UpstreamRateAggregator.__init__
# remains stateless. Move initialization to a FastAPI lifespan handler if stateful connection pools are added.
_aggregator_singleton = UpstreamRateAggregator()

# ISO-4217 minor-unit exponents for quantization of final converted amounts.
CURRENCY_MINOR_UNITS = {"JPY": 0}


def get_aggregator() -> UpstreamRateAggregator:
    return _aggregator_singleton


@router.get("/convert", response_model=BaseApiResponse[ConversionResultModel])
async def convert_currency(
    from_currency: CurrencyCode = Query(..., alias="from"),
    to_currency: CurrencyCode = Query(..., alias="to"),
    amount: Decimal = Query(..., gt=Decimal("0.0"), le=Decimal("1000000000000.00")),
    redis=Depends(get_redis_client),
    aggregator: UpstreamRateAggregator = Depends(get_aggregator)
):
    engine = RateEngine(redis, aggregator)

    try:
        unit_rate, inverse_rate, is_cached = await engine.get_rate_pair(
            from_currency=from_currency.value,
            to_currency=to_currency.value
        )
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail={"code": "UNSUPPORTED_CURRENCY_PAIR", "message": "Requested currency pair is not supported."}
        )
    except Exception:
        # Financial and infrastructural integrity: raw exception text is never
        # echoed to clients. Full context is logged server-side only.
        logger.exception("Upstream rate resolution failed for pair %s/%s", from_currency.value, to_currency.value)
        raise HTTPException(
            status_code=503,
            detail={"code": "UPSTREAM_RATE_UNAVAILABLE", "message": "Exchange rate service is temporarily unavailable."}
        )

    converted_amount = (amount * Decimal(unit_rate)).quantize(
        Decimal(1).scaleb(-CURRENCY_MINOR_UNITS.get(to_currency.value, 2)),
        rounding=ROUND_HALF_EVEN
    )
    timestamp_now = int(time.time() * 1000)

    result_payload = ConversionResultModel(
        from_currency=from_currency,
        to_currency=to_currency,
        amount=amount,
        converted_amount=str(converted_amount),
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
