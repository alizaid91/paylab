# PAYLAB Backend

## Setup

```bash
npm install
copy .env.example .env
```

Set a PostgreSQL `DATABASE_URL` and a random `JWT_SECRET` of at least 32 characters.

## Environment variables

`NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `LOG_LEVEL`, `CORS_ORIGIN`, `DB_POOL_MAX`, `JSON_BODY_LIMIT`, `AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX`, `AI_RATE_LIMIT_WINDOW_MS`, and `AI_RATE_LIMIT_MAX`.

## Database

```bash
npm run db:generate
npm run db:check
npm run db:seed
npm run db:studio
```

`db:seed` resets the `public` and `drizzle` schemas, applies all migrations, and creates the deterministic demo dataset.

## Development and production

```bash
npm run dev
npm run typecheck
npm run build
npm start
```

## Authentication

Register with `POST /api/auth/register`, then send the returned access token as `Authorization: Bearer <token>` on protected endpoints. Login uses `POST /api/auth/login`; the current user is available from `GET /api/auth/me`.

## API endpoints

- `GET /health`, `GET /ready`
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/merchant`, `PUT /api/merchant`
- `GET /api/payments`, `GET /api/payments/:id`, `GET /api/payments/stats`
- `GET /api/analytics/overview`, `/payment-methods`, `/failures`, `/trends`
- `POST /api/opportunities/analyze`, `GET /api/opportunities`, `GET /api/opportunities/:id`
- `POST /api/opportunities/:id/generate-strategy`
- `POST /api/strategies/:id/simulate`, `/advisory-review`, `/approve`, `/execute`
- `GET /api/strategies/:id/simulations`
- `POST /api/strategies/:id/policy-check`

## PAYLAB workflow

Authentication and merchant context scope payment data. PostgreSQL-backed analytics feed deterministic opportunity detection. Validated AI strategy generation is followed by deterministic simulation, validated advisory review, deterministic policy checks, merchant approval, simulated execution, execution results, and audit logging.
