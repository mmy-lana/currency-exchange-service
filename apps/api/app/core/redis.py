import redis.asyncio as aioredis
from app.core.config import settings

# INVARIANT: decode_responses=False is required monorepo-wide.
# Consumers must call .decode("utf-8") manually. Do not change.
_pool: aioredis.Redis | None = None


async def get_redis_client() -> aioredis.Redis:
    global _pool
    if _pool is None:
        _pool = aioredis.from_url(settings.REDIS_URL, decode_responses=False)
    return _pool
