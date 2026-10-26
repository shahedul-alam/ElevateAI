# CLAUDE.md

ElevateAI: an AI-assisted career platform MVP (resume evaluation, profile-to-job gap visualizer, job matching, job portal, dashboards). Product scope is in `ElevateAI MVP Project Proposal.md`; decisions, data model and phased build plan are in `IMPLEMENTATION_PLAN.md`. Read the plan before adding a feature.

## Layout

Bun-workspaces monorepo (`client`, `server`). Note: `IMPLEMENTATION_PLAN.md` describes a future `apps/*` + `packages/shared` layout; the repo currently uses `client/` and `server/`.

- `client/` (`@elevateai/client`): React 19 + Vite 8 + Tailwind 4 + TypeScript. Linted with oxlint. Still the Vite scaffold (`src/App.tsx`).
- `server/` (`@elevateai/server`): Express 5 + TypeScript on Bun, Prisma 7 (`@prisma/adapter-pg`) + PostgreSQL with pgvector, Zod 4, helmet, cors.
  - `src/index.ts`: app wiring, `/api/health`, graceful shutdown. Better Auth must be mounted before `express.json()` (comment in file).
  - `src/env.ts`: Zod-validated `process.env`; exits on invalid config. Import `env` from here, never read `process.env` elsewhere.
  - `src/db.ts`: single `prisma` client plus `connectDb` / `isDbConnected` / `disconnectDb`.
  - `src/middleware/errors.ts`: `notFound`, `errorHandler`, and `HttpError(status, message)`. Error responses are `{ error: { message } }`; 5xx messages are masked.
  - `prisma/schema.prisma`: no models yet; added per phase. Embedding columns use `Unsupported("vector(1536)")` and raw SQL.
  - Prisma client is generated to `server/generated/prisma` (gitignored); import from `../generated/prisma/client`.
- `docker-compose.yml`: `pgvector/pgvector:pg17` on host port **5433** (user/password/db: `postgres`/`postgres`/`elevateai`).

## Commands (run from repo root)

```
bun install
docker compose up -d db          # start Postgres + pgvector
bun run dev                      # client + server together
bun run dev:client | dev:server
bun run build                    # client only (tsc -b && vite build)
bun run typecheck                # server only (tsc --noEmit)
cd server && bun run db:generate # prisma generate (required after install / schema change)
cd server && bun run db:migrate  # prisma migrate dev
cd server && bun run db:deploy   # prisma migrate deploy
cd client && bun run lint        # oxlint
```

No test runner is configured yet.

## Environment

Copy `server/.env.example` to `server/.env`. Required: `DATABASE_URL` (matches the docker-compose port 5433), `BETTER_AUTH_SECRET` (min 32 chars). Defaults: `PORT=4000`, `CLIENT_ORIGIN=http://localhost:5173`, `BETTER_AUTH_URL=http://localhost:4000`. Never commit real secrets; `.env*` is gitignored except `.env.example`.

## Conventions

- Server is ESM TypeScript run directly by Bun; no build step. Imports are extensionless relative paths.
- Style: no semicolons, single quotes, 2-space indent, trailing commas.
- Validate all external input with Zod; throw `HttpError` for expected failures.
- Migrations: the first one enables pgvector (`CREATE EXTENSION IF NOT EXISTS vector`). Vector indexes (HNSW, cosine) go in hand-edited migration SQL.
- Planned stack (not yet built): Better Auth (roles `candidate | employer | admin`), BullMQ + Redis workers, Socket.IO, Vercel AI SDK for LLM calls. Keep to these when implementing those phases.
