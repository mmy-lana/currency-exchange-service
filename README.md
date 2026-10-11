# Currency & Exchange Microservice

A Tier-1 financial exchange rate engine and currency converter microservice built with React, FastAPI, and Redis inside a Turborepo monorepo. Engineered for sub-millisecond cross-rate evaluations, exact decimal financial math, and deterministic offline local operation.

---

## Architectural Highlights

- **USD Triangular Anchor Matrix**: Evaluates cross-currency pairs through a centralized USD anchor in a single hop, eliminating multi-hop vendor queries and delivering sub-millisecond conversions.
- **Strict Decimal Financial Integrity**: Eliminates IEEE-754 binary floating-point drift across calculations. Unit rates and converted amounts use `decimal.Decimal` with Banker's rounding (`ROUND_HALF_EVEN`), serialized as string-quantized values under ISO-4217 minor-unit constraints.
- **Two-Tier Cache & Immutable Storage**:
  - Live Rates: 120-second sliding-window cache in Redis hash `rates:latest:USD`.
  - Historical Rates: Daily market closes are stored permanently without expiration in Redis hash `rates:history:observations:{base}:{target}`, providing resilient offline charts during upstream vendor downtime.
- **Single-Flight Distributed Locking**: Cold-cache resolution is guarded by a Redis `SET NX` lock with atomic Lua script token release, preventing thundering herd cache stampedes on external APIs.
- **Reverse-Proxy Rate Limiting**: Built-in sliding-window limiter (60 req/min for conversion, 10 req/min for historical) resolving client IPs from `CF-Connecting-IP`, `X-Forwarded-For`, and direct socket connections with `ipaddress` syntax validation.
- **FinTech UI & Interaction Design**: Emerald green theme with accessible touch-pan scrubbing on SVG charts, in-flight cancellation via `AbortController`, 300ms input debouncing, quick-swap shortcut (`Alt+S`), and a 4-step focus-trapped Platform Guide.

---

## Monorepo Topology

```
currency-exchange-service/
├── apps/
│   ├── api/                     # FastAPI backend microservice
│   │   ├── app/
│   │   │   ├── core/            # Config, Redis client, security
│   │   │   ├── models/          # Decimal Pydantic DTOs & schemas
│   │   │   ├── routes/          # /v1/convert, /v1/rates/historical, /health
│   │   │   ├── services/        # RateEngine, CacheManager, Aggregator
│   │   │   └── workers/         # Background sync worker
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── web/                     # React + Vite + Tailwind v4 dashboard
│       ├── src/
│       │   ├── components/      # UI primitives, charts, platform guide
│       │   ├── hooks/           # useExchangeRate, useHistoricalRates
│       │   ├── lib/             # api-client (timeout-aware), formatters
│       │   └── store/           # Zustand exchange store
│       └── vite.config.ts       # Reverse proxy configuration
├── packages/
│   ├── shared-types/            # Canonical TypeScript contracts
│   ├── tsconfig/                # Strict TypeScript base configuration
│   └── ui-tokens/               # Design tokens (emerald palette)
├── tests/
│   └── e2e-verify.mjs           # Automated Puppeteer headless Chrome test suite
├── docker-compose.yml           # Complete offline development stack
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Prerequisites

- **Docker & Docker Compose** (recommended for deterministic offline execution)
- **Node.js**: v20+ or v22+
- **pnpm**: v9+ or v11+
- **Python**: v3.11+ (if running the API outside Docker)

---

## Quickstart (Offline via Docker Compose)

The fastest and most reliable way to run the entire service locally without external cloud dependencies:

1. Clone the repository and initialize environment variables:
   ```bash
   cp .env.example .env
   ```

2. Build and launch all container services:
   ```bash
   docker compose down -v
   docker compose up --build -d
   ```

3. Verify service health:
   ```bash
   docker compose ps
   ```
   Both `currency-redis` and `currency-api` will report `healthy`.

4. Access the applications:
   - **Frontend Dashboard**: http://localhost:5173
   - **Backend API**: http://localhost:8000
   - **Interactive API Documentation (Swagger)**: http://localhost:8000/docs
   - **API Health Endpoint**: http://localhost:8000/health

5. Tear down container volumes when finished:
   ```bash
   docker compose down -v
   ```

---

## Manual Local Development Setup

If you prefer running services directly on the host machine:

### 1. Start Redis
```bash
docker run -d --name currency-redis -p 6379:6379 redis:latest
```

### 2. Start the Backend API
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r apps/api/requirements.txt
uvicorn apps.api.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Start the Frontend Dashboard
```bash
pnpm install --frozen-lockfile
pnpm --filter web dev
```

---

## Automated Verification & Testing

The repository includes a comprehensive Puppeteer headless Chrome test runner covering API contracts, rate limiting, mobile viewport boundaries, and UI interactivity.

### Running End-to-End Tests

Ensure the application stack is running (via Docker or local host), then execute:

```bash
# Run against the default frontend URL (http://localhost:5173)
node tests/e2e-verify.mjs
```

The test runner validates:
- Zero browser console errors and clean CORS headers.
- Platform Guide modal opening, keyboard focus-trapping, and step progression.
- Live conversion amount debouncing and clipboard extraction.
- Proxy IP rate limit isolation (`X-Forwarded-For` independent quotas).
- Exact 1:1 identity conversion semantics (USD to USD returns `1.00000000`).
- Identity historical timeseries generation without upstream network calls.
- Historical SVG chart point coordinate calculation and pointer scrubbing.
- Error boundary recovery through user-triggered retries.
- Mobile viewports (360x640, 390x844, 430x932) with no horizontal overflow and minimum 44x44px touch targets.

### Monorepo Typechecking
```bash
pnpm run typecheck
```

---

## API Reference

### 1. Currency Conversion
```http
GET /v1/convert?from=USD&to=EUR&amount=1000
```

Response Envelope:
```json
{
  "success": true,
  "data": {
    "from": "USD",
    "to": "EUR",
    "amount": "1000",
    "convertedAmount": "921.45",
    "unitRate": "0.92145000",
    "inverseUnitRate": "1.08524608",
    "timestamp": 1728640000000
  },
  "error": null,
  "meta": {
    "timestamp": "2026-10-11T17:00:00.000000+00:00",
    "cached": true,
    "cacheTtlSeconds": 120
  }
}
```

### 2. Historical Timeseries
```http
GET /v1/rates/historical?base=USD&target=AUD&range=30D
```

Parameters:
- `base`: Supported ISO currency (USD, EUR, GBP, JPY, AUD, CAD, CHF, CNY, HKD, NZD, SGD).
- `target`: Supported ISO currency.
- `range`: `7D` | `30D` | `90D` | `1Y`.

### 3. System Health
```http
GET /health
```

---

## Future Production Deployment Blueprint

When ready to deploy into cloud infrastructure:

- **Frontend (Web)**: Deploy `apps/web` to Vercel. Set `VITE_API_URL` to the public Koyeb backend domain.
- **Backend (API)**: Deploy containerized `apps/api` to Koyeb using `apps/api/Dockerfile`.
- **Database (Redis)**: Provision Upstash Serverless Redis with TLS enabled. Configure `REDIS_URL=rediss://default:<token>@<endpoint>:6379` in Koyeb environment variables.
