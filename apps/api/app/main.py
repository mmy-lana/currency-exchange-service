import logging
import re
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.redis import close_redis_client, get_redis_client
from app.routes import convert, historical

logger = logging.getLogger("currency-exchange.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # DEF-04: bind the shared Redis pool to the application lifecycle so the
    # socket pool is closed cleanly on process termination.
    await get_redis_client()
    yield
    await close_redis_client()


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "HEAD"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-Client-Timestamp"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
)

app.include_router(convert.router, prefix=settings.API_V1_PREFIX)
app.include_router(historical.router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy"}


# ---------------------------------------------------------------------------
# SEC-01: dynamic CORS origin resolution for error envelopes.
#
# Starlette strips CORS headers whenever an unhandled exception bypasses
# CORSMiddleware. Echoing back the request's own Origin (after allow-list
# validation) keeps error responses consumable from every whitelisted origin,
# including 127.0.0.1 bindings and Vercel preview deployments.
# ---------------------------------------------------------------------------
_ORIGIN_REGEX = re.compile(settings.CORS_ORIGIN_REGEX) if settings.CORS_ORIGIN_REGEX else None


def _origin_is_trusted(origin: str) -> bool:
    return origin in settings.CORS_ORIGINS or bool(_ORIGIN_REGEX and _ORIGIN_REGEX.match(origin))


def get_cors_headers(request: Request) -> dict:
    origin = request.headers.get("origin")
    if origin and _origin_is_trusted(origin):
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-Client-Timestamp",
        }
    # No origin header (server-to-server or curl) or untrusted origin: omit
    # CORS headers entirely rather than reflecting an unvalidated value.
    return {}


def _error_envelope(code: str, message: str) -> dict:
    return {
        "success": False,
        "data": None,
        "error": {"code": code, "message": message},
        "meta": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "cached": False,
            "cacheTtlSeconds": 0,
        },
    }


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict):
        code = exc.detail.get("code", "HTTP_ERROR")
        message = exc.detail.get("message", "Request failed.")
    else:
        code = "HTTP_ERROR"
        message = str(exc.detail)
    headers = dict(exc.headers or {})
    headers.update(get_cors_headers(request))
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_envelope(code, message),
        headers=headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=_error_envelope("VALIDATION_ERROR", "Request validation failed."),
        headers=get_cors_headers(request),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled server exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content=_error_envelope("INTERNAL_SERVER_ERROR", "An unexpected server error occurred."),
        headers=get_cors_headers(request),
    )


# ---------------------------------------------------------------------------
# SEC-02: Redis-backed fixed-window rate limiting for public API routes.
#
# Keys: ratelimit:{client_ip}:{route_path}. Limits per architecture contract:
# 60 req/60s for /v1/convert, 10 req/60s for /v1/rates/historical. Redis
# outages fail open with a warning so the API remains functional offline.
# ---------------------------------------------------------------------------
RATE_LIMITS = {
    "/v1/convert": 60,
    "/v1/rates/historical": 10,
}
RATE_LIMIT_WINDOW_SECONDS = 60


def _error_response(request: Request, status: int, code: str, message: str, headers: dict) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content=_error_envelope(code, message),
        headers=headers,
    )


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    path = request.url.path
    limit = RATE_LIMITS.get(path)
    if request.method == "OPTIONS" or limit is None:
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    cache_key = f"ratelimit:{client_ip}:{path}"
    remaining = limit - 1
    reset_epoch = int(time.time()) + RATE_LIMIT_WINDOW_SECONDS
    base_headers = {
        "X-RateLimit-Limit": str(limit),
        "X-RateLimit-Remaining": str(remaining),
        "X-RateLimit-Reset": str(reset_epoch),
    }

    try:
        redis_client = await get_redis_client()
        current = await redis_client.incr(cache_key)
        if current == 1:
            await redis_client.expire(cache_key, RATE_LIMIT_WINDOW_SECONDS)
        base_headers["X-RateLimit-Remaining"] = str(max(0, limit - current))
        if current > limit:
            headers = dict(base_headers)
            headers.update(get_cors_headers(request))
            logger.warning("Rate limit breached for %s on %s (%d/%d)", client_ip, path, current, limit)
            return _error_response(
                request, 429, "RATE_LIMIT_EXCEEDED", "Too many requests. Please slow down.", headers
            )
    except Exception:
        # Fail open: rate limiting is a protection layer, never an availability risk.
        logger.warning("Rate limiter unavailable; failing open for %s on %s", client_ip, path, exc_info=True)

    response = await call_next(request)
    for header, value in base_headers.items():
        response.headers.setdefault(header, value)
    return response
