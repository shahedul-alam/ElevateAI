# CLAUDE.md

ElevateAI: an AI-assisted career platform MVP (resume evaluation, profile-to-job gap visualizer, job matching, job portal, dashboards). Product scope is in `ElevateAI MVP Project Proposal.md`; decisions, data model and phased build plan are in `IMPLEMENTATION_PLAN.md`. Read the plan before adding a feature.

## Layout

Bun-workspaces monorepo (`client`, `server`). Note: `IMPLEMENTATION_PLAN.md` describes a future `apps/*` + `packages/shared` layout; the repo currently uses `client/` and `server/`.

- `client/` (`@elevateai/client`): React 19 + Vite 8 + Tailwind 4 + TypeScript. Linted with oxlint. shadcn/ui (radix, nova preset; add components with `bunx --bun shadcn@latest add <name>` from `client/`) and react-router (`BrowserRouter` in `main.tsx`, routes in `App.tsx`, pages in `src/pages/`). `components/theme-provider.tsx` handles light/dark/system (class on `<html>`, `theme` in localStorage, pre-paint script in `index.html`); `components/navbar.tsx` has the nav links (placeholders), theme toggle and Log in / Sign up links. Sign-up is wired: `src/features/auth/` (`auth.schema.ts` zod mirror of the server, `auth.api.ts` axios calls, `auth.store.ts` zustand user, `use-register.ts` TanStack mutation), `lib/api.ts` (axios instance + `getApiError`), react-hook-form + zodResolver on `/register`, Sonner toasts (`<Toaster />` in `App.tsx`). The user is restored from the session cookie on startup: `useSession()` (in `App.tsx`) calls `GET /api/me` via TanStack Query (key `SESSION_KEY`) and syncs the zustand store, whose `status` is `loading | authenticated | anonymous` (the navbar shows a placeholder while loading; route guards should wait for it). A 401 on any protected request clears the user (`lib/api.ts` interceptor). `/login` is wired the same way (`loginSchema`, `loginRequest`, `use-login.ts`; a 401 is one generic toast and clears the password). `/login` and `/register` redirect home when already signed in.
- `server/` (`@elevateai/server`): Express 5 + TypeScript on Bun, Prisma 7 (`@prisma/adapter-pg`) + PostgreSQL with pgvector, Zod 4, helmet, cors.
  - Feature modules with MVC: `src/modules/<name>/` holds `<name>.routes.ts` (paths + middleware only), `<name>.controller.ts` (HTTP in/out only, no business logic), `<name>.service.ts` (business logic + Prisma, no `req`/`res`) and `<name>.schema.ts` (Zod input schemas) when the module takes input. The Prisma schema is the Model layer; there is no view/serializer layer. Create only the files a module needs. Flow: routes -> controller -> service -> Prisma.
  - `src/index.ts`: startup and graceful shutdown. `src/app.ts`: `createApp()` (helmet, cors, auth handler, json, `/api` router, error handlers). `src/routes.ts`: mounts module routers under `/api`; register new modules here.
  - `src/config/env.ts`: Zod-validated `process.env`; exits on invalid config. Import `env` from here, never read `process.env` elsewhere. `src/config/db.ts`: single `prisma` client plus `connectDb` / `isDbConnected` / `disconnectDb`.
  - `src/middleware/errors.ts`: shared `notFound`, `errorHandler`, `HttpError(status, message)`. Error responses are `{ error: { message } }`; 5xx messages are masked.
  - `modules/auth`: `auth.config.ts` is the Better Auth instance (email/password, Prisma adapter, DB-backed rate limits); `role` is an extra user field, sign-up must send `candidate` or `employer` (enforced in `hooks.before`, for every caller) and `/update-user` cannot change it. `auth.routes.ts` serves `/api/auth/*` and is mounted before `express.json()`; the public entry points are `POST /api/auth/register` and `POST /api/auth/login` (Zod `auth.schema.ts`, `registerUser` / `loginUser` in the service, both set the session cookie; login gives one generic 401 for wrong email or password; 5/min IP limit each via `express-rate-limit`, because Better Auth's limiter skips server-side calls). Better Auth's raw `/sign-up/email` and `/sign-in/email` are blocked with 404; sign-out and session stay on Better Auth (`POST /api/auth/sign-out`). `auth.routes.ts` also overwrites the `x-client-ip` header with `req.ip` before the Better Auth handler (and `auth.config.ts` reads it via `advanced.ipAddress.ipAddressHeaders`), otherwise Better Auth rate-limits all clients in one shared bucket; set Express `trust proxy` if deployed behind a proxy. Shared helpers: `middleware/validate.ts` (`validate(schema)` -> 400 with `details`) and `HttpError(status, message, details?)`. `auth.middleware.ts` has `requireAuth` (sets `req.auth`) and `requireRole(...roles)`. `auth.service.ts` has `ensureAdmin`.
  - `modules/user`: `GET /api/me`. `modules/health`: `GET /api/health`. `modules/home`: `GET /` at the server root (outside `/api`, mounted in `app.ts`).
  - `scripts/seed-admin.ts`: thin wrapper around `ensureAdmin` using `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
  - `prisma/schema.prisma`: Better Auth models (User, Session, Account, Verification, RateLimit) written by hand because the Better Auth CLI needs a native build; more models are added per phase. Embedding columns use `Unsupported("vector(1536)")` and raw SQL.
  - Prisma client is generated to `server/generated/prisma` (gitignored); import from `../../generated/prisma/client` (see `src/config/db.ts`).
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
cd server && bun run db:seed-admin # create the admin user from ADMIN_EMAIL / ADMIN_PASSWORD
cd client && bun run lint        # oxlint
```

No test runner is configured yet.

## Environment

Copy `server/.env.example` to `server/.env`. Required: `DATABASE_URL` (matches the docker-compose port 5433), `BETTER_AUTH_SECRET` (min 32 chars). Optional: `ADMIN_EMAIL`, `ADMIN_PASSWORD` (min 12 chars); when both are set the server seeds the admin on startup (idempotent). Defaults: `PORT=4000`, `CLIENT_ORIGIN=http://localhost:5173`, `BETTER_AUTH_URL=http://localhost:4000`. Never commit real secrets; `.env*` is gitignored except `.env.example`.

## Conventions

- Server is ESM TypeScript run directly by Bun; no build step. Imports are extensionless relative paths.
- Style: no semicolons, single quotes, 2-space indent, trailing commas.
- Validate all external input with Zod (schemas in `<name>.schema.ts`); throw `HttpError` for expected failures.
- Migrations: the first one enables pgvector (`CREATE EXTENSION IF NOT EXISTS vector`). Vector indexes (HNSW, cosine) go in hand-edited migration SQL.
- Auth: Better Auth with roles `candidate | employer | admin`; guard routes with `requireAuth` / `requireRole`. Email verification and password reset are not built yet.
- Planned stack (not yet built): BullMQ + Redis workers, Socket.IO, Vercel AI SDK for LLM calls. Keep to these when implementing those phases.
