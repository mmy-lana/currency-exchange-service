import logging
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

logger = logging.getLogger("currency-exchange.historical")

router = APIRouter(tags=["Historical Analytics"])


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
    except Exception:
        # Sanitized error contract: exception internals stay server-side.
        logger.exception("Historical series unavailable for %s/%s (%s)", base.value, target.value, time_range.value)
        raise HTTPException(
            status_code=503,
            detail={"code": "HISTORICAL_DATA_UNAVAILABLE", "message": "Historical rate data is temporarily unavailable."}
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
