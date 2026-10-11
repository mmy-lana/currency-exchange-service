# Architecture & System Design

### System Overview & Topology

Monorepo topology orchestrated via Turborepo. Development leverages local Docker services for offline-first parity; production targets Vercel for the React frontend, Koyeb for the containerized FastAPI backend, and Upstash for serverless Redis.

```
currency-exchange-service/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── apps/
│   ├── api/
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── core/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── config.py
│   │   │   │   ├── redis.py
│   │   │   │   └── security.py
│   │   │   ├── models/
│   │   │   │   ├── __init__.py
│   │   │   │   └── schemas.py
│   │   │   ├── routes/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── convert.py
│   │   │   │   ├── historical.py
│   │   │   │   ├── live.py
│   │   │   │   └── status.py
│   │   │   ├── services/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── aggregator.py
│   │   │   │   ├── cache_manager.py
│   │   │   │   └── rate_engine.py
│   │   │   ├── workers/
│   │   │   │   ├── __init__.py
│   │   │   │   └── sync_worker.py
│   │   │   └── main.py
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   └── requirements.txt
│   └── web/
│       ├── public/
│       │   └── favicon.ico
│       ├── src/
│       │   ├── assets/
│       │   ├── components/
│       │   │   ├── charts/
│       │   │   ├── forms/
│       │   │   ├── layout/
│       │   │   └── ui/
│       │   ├── hooks/
│       │   │   ├── use-exchange-rate.ts
│       │   │   ├── use-historical-rates.ts
│       │   │   └── use-rate-stream.ts
│       │   ├── lib/
│       │   │   ├── api-client.ts
│       │   │   ├── formatters.ts
│       │   │   └── utils.ts
│       │   ├── store/
│       │   │   └── exchange-store.ts
│       │   ├── App.tsx
│       │   ├── index.css
│       │   ├── main.tsx
│       │   └── vite-env.d.ts
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
├── packages/
│   ├── shared-types/
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── ui-tokens/
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── tsconfig/
│       ├── base.json
│       └── package.json
├── docker-compose.yml
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── README.md
└── turbo.json
```

### Toolchain Specifications

- Package Manager: pnpm strict mode (pnpm@latest).
- Monorepo Engine: Turborepo (turbo@latest).
- Frontend Core:
  - Runtime & Bundler: React (react@latest, react-dom@latest) driven by Vite (vite@latest).
  - Styling: Tailwind CSS v4 (tailwindcss@latest, @tailwindcss/vite@latest).
  - Strict TypeScript configuration with noImplicitAny: true, strictNullChecks: true, and exactOptionalPropertyTypes: true.
- Backend Core:
  - Runtime: Python (python:latest Docker Alpine base).
  - Framework: FastAPI (fastapi@latest) with ASGI server (uvicorn@latest).
  - Async HTTP Client: HTTPX (httpx@latest).
  - Redis Client: redis-py (redis@latest) for high-throughput async pipelining.
- Offline / Local Containerization:
  - Docker Compose provisioning redis:latest, apps/api via FastAPI reload mode, and apps/web on Vite HMR.

### Global Data Layer

- Database Client Topology:
  - Offline / Dev: Local Redis standalone instance accessible via redis://redis:6379/0.
  - Production: Upstash Redis accessed via TLS socket rediss://default:<token>@<host>:6379 or REST endpoints.
  - Storage Schema:
    - `rates:latest:{BASE_CURRENCY}`: Redis Hash containing target ISO-4217 currency rates and last modified timestamp (120-second TTL).
    - `rates:timeseries:{BASE}:{TARGET}:{RANGE}`: Redis String containing serialized historical timeseries JSON (3600-second TTL).
    - `queue:deadletter:sync`: Redis List storing failed synchronization events for diagnostic replay.
- State Store Architecture:
  - Global UI & Conversion Store: Zustand (zustand@latest) managing selected pairs, user amounts, real-time recalculation flags, and historical timeline states.
  - Server Cache & Revalidation: Custom React Hook abstractions wrapping standard Web Fetch API with AbortController signal handling.
- Base API Standard Envelope:
  All API responses enforce the following schema:
  ```json
  {
    "success": true,
    "data": {},
    "error": null,
    "meta": {
      "timestamp": "2026-10-11T06:35:00.000Z",
      "cached": true,
      "cache_ttl_seconds": 120
    }
  }
  ```
- Idempotency & Deduplication Contract:
  - Currency conversion routes (/v1/convert) are read-only idempotently cacheable operations.
  - Frontend clients must enforce a 300ms UI debounce on numeric inputs and cancel inflight calls via AbortController before issuing new conversions.
- Redis Client Invariant:
  - decode_responses=False is strictly enforced across apps/api/app/core/redis.py and all consumer modules to preserve raw byte pipeline semantics.

### Security & Constraints

- Authentication & Ingestion Authorization:
  - Ingestion APIs (/internal/v1/*) secured via SHA-256 HMAC signature verification with timing-safe comparison (X-Signature header).
  - Public consumption APIs leverage transient IP-based rate limiting.
- Rate Limiting Engine:
  - Token-bucket algorithm executed directly inside Redis using async Lua scripts.
  - Limit: 60 requests/minute per IP address for standard conversion; 10 requests/minute for deep historical timeseries querying.
- CORS Architecture:
  - Production whitelist constrained via exact origin configuration and allow_origin_regex for preview deployments.
  - Allowed Headers: Content-Type, Authorization, X-Requested-With, X-Client-Timestamp.
  - Exposed Headers explicitly wired in FastAPI CORSMiddleware(expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"]).
- Error Boundaries:
  - Frontend: Granular React Error Boundaries wrapping isolated card components with manual recovery triggers.
  - Backend: Global FastAPI RequestValidationError and custom exception handlers returning structured JSON matching the standard envelope.
