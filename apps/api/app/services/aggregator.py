from typing import Dict
import httpx
from app.models.schemas import CurrencyCode


class UpstreamRateAggregator:
    PRIMARY_URL = "https://api.frankfurter.app/latest"
    FALLBACK_URL = "https://open.er-api.com/v6/latest/USD"

    async def fetch_latest_rates(self) -> Dict[str, float]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                response = await client.get(f"{self.PRIMARY_URL}?from=USD")
                if response.status_code == 200:
                    data = response.json()
                    raw_rates = data.get("rates", {})
                    raw_rates["USD"] = 1.0
                    return {k: float(v) for k, v in raw_rates.items() if k in CurrencyCode.__members__}
            except (httpx.RequestError, httpx.HTTPStatusError):
                pass

            try:
                response = await client.get(self.FALLBACK_URL)
                if response.status_code == 200:
                    data = response.json()
                    raw_rates = data.get("rates", {})
                    return {k: float(v) for k, v in raw_rates.items() if k in CurrencyCode.__members__}
            except Exception as exc:
                raise RuntimeError(f"All upstream exchange authorities failed: {str(exc)}")

            raise RuntimeError("Non-200 responses received across rate aggregation pool")
