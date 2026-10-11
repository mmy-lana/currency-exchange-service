from datetime import timedelta, timezone
from typing import Dict, List, Tuple
import httpx
from app.models.schemas import CurrencyCode


class UpstreamRateAggregator:
    PRIMARY_URL = "https://api.frankfurter.dev/v1/latest"
    FALLBACK_URL = "https://open.er-api.com/v6/latest/USD"
    HISTORICAL_URL = "https://api.frankfurter.dev/v1"

    async def fetch_latest_rates(self) -> Dict[str, float]:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
            try:
                response = await client.get(f"{self.PRIMARY_URL}?base=USD")
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

    async def fetch_historical_timeseries(self, base: str, target: str, range_str: str) -> List[Tuple[str, str]]:
        """Fetch a genuine daily close timeseries from the upstream authority.

        Returns an ordered list of (date_iso, rate_string) tuples. Rates remain
        strings end-to-end; no IEEE-754 conversion ever occurs in this pathway.
        Raises RuntimeError when the upstream authority is unreachable or the
        requested pair carries no published history.
        """
        from datetime import datetime

        days_map = {"7D": 7, "30D": 30, "90D": 90, "1Y": 365}
        days = days_map.get(range_str, 30)

        end_date = datetime.now(timezone.utc).date()
        start_date = end_date - timedelta(days=days)
        url = f"{self.HISTORICAL_URL}/{start_date.isoformat()}..{end_date.isoformat()}?base={base}&symbols={target}"

        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            try:
                response = await client.get(url)
            except httpx.RequestError as exc:
                raise RuntimeError(f"Historical timeseries upstream unreachable: {type(exc).__name__}")

            if response.status_code != 200:
                raise RuntimeError(f"Historical timeseries upstream returned HTTP {response.status_code}")

            data = response.json()
            rates_by_date: Dict[str, Dict[str, float]] = data.get("rates", {})
            series: List[Tuple[str, str]] = []
            for date_key in sorted(rates_by_date.keys()):
                pair_rates = rates_by_date[date_key]
                if target in pair_rates:
                    series.append((date_key, str(pair_rates[target])))

            if not series:
                raise RuntimeError(
                    f"Historical timeseries contains no published observations for {base}/{target}"
                )
            return series
