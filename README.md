# PAYLAB

PAYLAB is an MVP simulation and governance layer for autonomous financial agents.
The repository contains two independent applications:

- `backend/` — Express, TypeScript, PostgreSQL, and Drizzle ORM
- `frontend/` — Next.js, TypeScript, Tailwind CSS, TanStack Query, and Recharts

## Local setup

1. Ensure PostgreSQL is running and create a `paylab` database.
2. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL`.
3. Run `npm install` in both `backend/` and `frontend/`.
4. From `backend/`, run `npm run db:migrate` and `npm run db:seed`.
5. Start the API with `npm run dev`.
6. Start the dashboard from `frontend/` with `npm run dev`.

The frontend calls the backend at `http://localhost:4000` by default. Override
this with `frontend/.env.local` and `NEXT_PUBLIC_API_URL`.
