# PAYLAB

**An AI-powered payment operations and recovery-campaign platform that turns payment data into explainable, governed, and measurable actions.**

![PAYLAB platform banner](frontend/public/readme_banner.png)

PAYLAB closes the operational loop from payment data to opportunity detection, strategy generation, simulation, advisory review, policy validation, merchant approval, recovery campaigns, results, and audit trail. Revenue recovery is the primary use case, but the platform is designed around a broader problem: converting payment operations data into controlled decisions that can be evaluated and acted on.

> **Current scope:** PAYLAB works with seeded or application-managed payment data. Recovery Campaign processing is simulated and does not initiate real payment operations.

## What is PAYLAB?

Most payment systems stop at reporting: they show volume, success rates, and failures. PAYLAB is built for the next operational step. It identifies meaningful patterns, turns them into actionable strategies, tests expected impact, reviews risks, applies enforceable controls, and records what happened.

The platform separates analytical evidence, AI-assisted judgment, deterministic governance, and recovery campaign state. That makes each proposed action explainable and reviewable rather than an opaque recommendation or an isolated dashboard metric.

## Getting started with PAYLAB

New users begin by registering an account. Registration creates the user and their merchant workspace, then signs them in to the application. Before payment analysis can begin, the merchant chooses a data source from the **Data Source** page:

1. **Register** with a name, email, password, and merchant name.
2. **Open the data-source onboarding screen** from the workspace.
3. **Choose a source**:
   - **Use Demo Data** generates realistic customers, payments, and payment attempts for the authenticated merchant.
   - **Connect Razorpay** is displayed as a UI option, but provider OAuth and live ingestion are not implemented yet.
4. **Continue to the dashboard** after demo data generation completes.

## System architecture

PAYLAB is split into a browser-based operations workspace and a workflow-oriented backend. The frontend presents the decision lifecycle; the backend owns merchant scoping, state transitions, persistence, AI orchestration, policy enforcement, Recovery Campaign processing, and auditability.

```mermaid
flowchart TB
    UI[Next.js Operations Workspace<br/>React + TanStack Query + Recharts]
    API[Express Workflow API<br/>TypeScript]
    AUTH[JWT Authentication<br/>bcrypt]
    DATA[Payment and merchant data]
    DETECT[Opportunity detection]
    DECIDE[Strategies and simulations]
    GOVERN[Advisory and policy gates]
    CAMPAIGN[Approval and Recovery Campaigns]
    AI[Gemini provider<br/>structured JSON]
    DB[(PostgreSQL)]
    ORM[Drizzle ORM and migrations]

    UI -->|JSON over HTTP| API
    API --> AUTH
    API --> DATA
    API --> DETECT
    API --> DECIDE
    API --> GOVERN
    API --> CAMPAIGN
    DATA --> ORM
    DETECT --> ORM
    DECIDE --> ORM
    GOVERN --> ORM
    CAMPAIGN --> ORM
    ORM --> DB
    DECIDE --> AI
    GOVERN --> AI
    DATA --> DB
    DETECT --> DB
    DECIDE --> DB
    GOVERN --> DB
    CAMPAIGN --> DB
```

### Major backend modules

- `auth` — registration, login, current-user lookup, access tokens.
- `merchants` — merchant profile and merchant context.
- `payments` — paginated payment records, payment details, statistics.
- `analytics` — overview, payment-method, failure-dimension, and trend analytics.
- `opportunities` — deterministic detection, listing, details, and strategy generation entry point.
- `strategies` — strategy retrieval, simulation, advisory review, and merchant approval.
- `policies` — merchant policy configuration and deterministic policy evaluation.
- `recovery-campaigns` — approved strategy campaigns, bounded simulated processing, lifecycle controls, recovery metrics, and campaign state.
- `audit-logs` — immutable-style workflow event history exposed to the authenticated merchant.
- `ai` — Gemini provider, structured strategy generation, and advisory validation.

## Project structure

```text
.
├── backend/
│   ├── drizzle/                 # PostgreSQL migration SQL and metadata
│   ├── src/
│   │   ├── ai/                  # Gemini provider, strategy generator, advisory agent
│   │   ├── config/              # Environment parsing and logging
│   │   ├── db/                  # Drizzle client, schema, reset
│   │   ├── middleware/          # Authentication, rate limiting, logging, errors
│   │   ├── modules/
│   │   │   ├── analytics/
│   │   │   ├── audit-logs/
│   │   │   ├── auth/
│   │   │   ├── recovery-campaigns/
│   │   │   ├── merchants/
│   │   │   ├── opportunities/
│   │   │   ├── payments/
│   │   │   ├── policies/
│   │   │   ├── simulations/
│   │   │   └── strategies/
│   │   ├── app.ts                # Express app and route registration
│   │   └── server.ts             # HTTP server and graceful shutdown
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/                  # Next.js routes
│   │   ├── components/           # Dashboard, review, campaigns, and UI components
│   │   └── lib/                 # API clients and frontend utilities
│   ├── .env.example
│   └── package.json
└── README.md
```

## Environment variables

### Backend

Copy `backend/.env.example` to `backend/.env`. Values below are names and safe development defaults only; do not commit real secrets.

| Variable | Required | Purpose |
|---|---|---|
| `NODE_ENV` | No | `development`, `test`, or `production`; defaults to `development`. |
| `PORT` | No | Express port; defaults to `3000`. |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `JWT_SECRET` | Yes | At least 32 characters; used to sign access tokens. |
| `JWT_EXPIRES_IN` | No | JWT lifetime; defaults to `1h`. |
| `LOG_LEVEL` | No | Pino log level; defaults to `info`. |
| `CORS_ORIGIN` | No | Allowed frontend origin; defaults to `*`. |
| `DB_POOL_MAX` | No | PostgreSQL pool size; defaults to `10`. |
| `JSON_BODY_LIMIT` | No | Express JSON body limit; defaults to `1mb`. |
| `AUTH_RATE_LIMIT_WINDOW_MS` | No | Authentication rate-limit window; defaults to `900000`. |
| `AUTH_RATE_LIMIT_MAX` | No | Authentication requests per window; defaults to `20`. |
| `AI_RATE_LIMIT_WINDOW_MS` | No | AI endpoint rate-limit window; defaults to `900000`. |
| `AI_RATE_LIMIT_MAX` | No | AI requests per window; defaults to `10`. |
| `GEMINI_API_KEY` | For AI features | Google Gemini API key. |
| `GEMINI_MODEL` | No | Gemini model name; defaults to `gemini-3.6-flash`. |

### Frontend

Copy `frontend/.env.example` to `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

Set this to the URL where the backend API is running. The backend defaults to port `3000`; use `http://localhost:8000/api` instead if you configure `PORT=8000`. The frontend stores the returned access token in browser `sessionStorage`.

## Local setup

### Prerequisites

- Node.js with npm.
- A running PostgreSQL instance and an empty `paylab` database.
- A Gemini API key if you want to use strategy generation and advisory review.

### Install and configure

```powershell
cd backend
npm install
Copy-Item .env.example .env

cd ..\frontend
npm install
Copy-Item .env.example .env.local
```

Set `DATABASE_URL` and a strong `JWT_SECRET` in `backend/.env`. Set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` if the API is not at the configured default.

### Apply migrations

The reset command resets the PostgreSQL `public` and `drizzle` schemas.

```powershell
cd backend
npm run db:reset
```

Other database commands available in the backend:

```powershell
npm run db:generate
npm run db:migrate
npm run db:check
npm run db:studio
```

### Run the applications

In one terminal:

```powershell
cd backend
npm run dev
```

In a second terminal:

```powershell
cd frontend
npm run dev
```

The backend exposes health checks at `/health` and `/ready`. Open the frontend URL printed by Next.js, normally `http://localhost:3000`.

## Future improvements

These are not current capabilities; they are possible extensions:

- Add payment-provider ingestion, webhooks, idempotency, and reconciliation.
- Calibrate recovery assumptions from historical cohorts and measured experiment outcomes.
- Expand detection to issuer, error-code, geography, cohort, and provider patterns.
- Add backtesting, confidence intervals, experiment tracking, and strategy version comparison.
- Connect approved actions to a sandbox payment provider before considering controlled production integrations.
- Add granular role-based permissions, approval delegation, and stronger operational controls.
- Add background jobs for large datasets and scheduled analysis.
- Add automated API contract tests, end-to-end workflow tests, and deployment documentation.
