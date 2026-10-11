import asyncio
import json
import logging
import signal
import time
import uuid
from typing import Optional
import redis.asyncio as redis
from app.core.config import settings
from app.services.aggregator import UpstreamRateAggregator

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")
logger = logging.getLogger("sync-worker")

# Atomic lock release: the lock is deleted only when its stored value still
# matches this worker's unique token, preventing premature release of a lease
# that has already expired and been re-acquired by another process.
RELEASE_LOCK_SCRIPT = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
"""


async def run_sync_cycle(redis_client: redis.Redis, aggregator: UpstreamRateAggregator) -> Optional[bool]:
    lock_key = "lock:sync:USD"
    token = str(uuid.uuid4())
    is_locked = False

    try:
        # redis-py returns True | None for SET NX; coerce to bool
        is_locked = bool(await redis_client.set(lock_key, token, nx=True, ex=15))
        if not is_locked:
            logger.info("Another sync process owns the ingestion lease. Skipping interval.")
            return None

        logger.info("Initiating upstream rate synchronization cycle...")
        rates = await aggregator.fetch_latest_rates()

        cache_key = "rates:latest:USD"
        rates_payload = {k: str(v) for k, v in rates.items()}
        rates_payload["_updated_at"] = str(int(time.time() * 1000))

        async with redis_client.pipeline(transaction=True) as pipe:
            pipe.delete(cache_key)
            pipe.hset(cache_key, mapping=rates_payload)
            pipe.expire(cache_key, 120)
            await pipe.execute()

        logger.info(f"Successfully updated {len(rates)} currency pairs under cache: {cache_key}")
        return True
    except Exception as exc:
        logger.error(f"Sync execution failed: {str(exc)}")
        try:
            dead_letter_payload = json.dumps({
                "timestamp": int(time.time() * 1000),
                "error": str(exc),
                "stage": "sync_worker_cycle"
            })
            await redis_client.rpush("queue:deadletter:sync", dead_letter_payload)
        except Exception as dl_err:
            logger.critical(f"Dead-letter write failed: {str(dl_err)}")
        return False
    finally:
        if is_locked:
            try:
                await redis_client.eval(RELEASE_LOCK_SCRIPT, 1, lock_key, token)
            except Exception as release_err:
                logger.error(f"Lock release failed (lease expires autonomously): {str(release_err)}")


async def main():
    logger.info("Starting Exchange Background Sync Engine...")
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=False)
    aggregator = UpstreamRateAggregator()
    consecutive_failures = 0

    loop = asyncio.get_running_loop()
    stop_signal = loop.create_future()

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda: stop_signal.done() or stop_signal.set_result(None))

    try:
        while not stop_signal.done():
            cycle_status: Optional[bool] = None
            try:
                cycle_status = await run_sync_cycle(redis_client, aggregator)
            except Exception as global_exc:
                logger.critical(f"Unhandled sync loop failure: {str(global_exc)}")
                cycle_status = False

            if cycle_status is True:
                consecutive_failures = 0
                sleep_duration = 60
            elif cycle_status is False:
                consecutive_failures += 1
                sleep_duration = 120 if consecutive_failures >= 3 else 60
                logger.warning(
                    f"Sync failure count: {consecutive_failures}. Next poll scheduled in {sleep_duration}s."
                )
            else:
                if consecutive_failures > 0:
                    consecutive_failures -= 1
                sleep_duration = 60

            # Shutdown latency is bounded at 1 second per tick loop iteration
            for _ in range(sleep_duration):
                if stop_signal.done():
                    break
                await asyncio.sleep(1)
            if stop_signal.done():
                break
    finally:
        await redis_client.aclose()
        logger.info("Sync worker shutdown finalized cleanly.")


if __name__ == "__main__":
    asyncio.run(main())
