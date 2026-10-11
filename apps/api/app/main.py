import logging
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.routes import convert, historical

logger = logging.getLogger("currency-exchange.main")

app = FastAPI(title=settings.PROJECT_NAME)

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


# Starlette strips CORS headers whenever an unhandled exception bypasses
# CORSMiddleware, causing opaque browser NetworkError failures. These handlers
# guarantee every error envelope is emitted with CORS headers re-attached.
CORS_ERROR_HEADERS = {
    "Access-Control-Allow-Origin": settings.CORS_ORIGINS[0],
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-Client-Timestamp",
}


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


def _origin_present(request: Request) -> bool:
    return request.headers.get("origin") is not None


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict):
        code = exc.detail.get("code", "HTTP_ERROR")
        message = exc.detail.get("message", "Request failed.")
    else:
        code = "HTTP_ERROR"
        message = str(exc.detail)
    headers = dict(exc.headers or {})
    if _origin_present(request):
        headers.update(CORS_ERROR_HEADERS)
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_envelope(code, message),
        headers=headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    headers = CORS_ERROR_HEADERS if _origin_present(request) else {}
    return JSONResponse(
        status_code=422,
        content=_error_envelope("VALIDATION_ERROR", "Request validation failed."),
        headers=headers,
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled server exception on %s %s", request.method, request.url.path)
    headers = CORS_ERROR_HEADERS if _origin_present(request) else {}
    return JSONResponse(
        status_code=500,
        content=_error_envelope("INTERNAL_SERVER_ERROR", "An unexpected server error occurred."),
        headers=headers,
    )
