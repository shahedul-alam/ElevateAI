# ElevateAI

An AI-assisted career platform (MVP): candidates build a resume and see exactly how they match a job, employers post jobs and get ranked shortlists, and admins moderate the platform.

## Features

- **Candidates:** resume builder with version history and restore, PDF download, resume import from PDF/DOCX, AI resume review, job browsing, a live match score with a gap breakdown and AI-written advice, applications with status history, dashboard and notifications.
- **Employers:** company profile, job posts (draft, active, closed) with a live preview, applicants ranked by match score, a hiring pipeline with notes, ratings and status changes, and AI-drafted job posts and applicant summaries.
- **Matching:** a deterministic, versioned scoring engine (skills, experience, domain, education, leadership, certifications). Scores are frozen at the moment of applying.
- **Admin:** user, job and company moderation (suspend, restore, verify), an audit log, and account deletion.
- **Platform:** email verification and password reset, optional Google sign-in, in-app and email notifications, light/dark theme.
- **AI:** resume import, resume review, job draft, gap explanation and applicant summary. Every AI call needs the user's consent, and the app works with AI turned off (`AI_ENABLED=false`).

## Tech stack

| Area | Tools |
|---|---|
| Client | React 19, Vite, TypeScript, Tailwind 4, shadcn/ui, React Router, TanStack Query, zustand, react-hook-form + Zod, Chart.js, `@react-pdf/renderer` |
| Server | Bun, Express 5, TypeScript, Zod 4, Better Auth, Prisma 7 |
| Data | PostgreSQL (pgvector image), Redis with BullMQ |
| AI | Vercel AI SDK with OpenAI |
| Tests | `bun test` (unit), Playwright (end to end) |

## Repository layout

```
client/    React app (@elevateai/client)
server/    Express API (@elevateai/server), Prisma schema and migrations, scripts
e2e/       Playwright specs and helpers
deploy/    Caddy config for the single-origin production setup
```

More detail: [`CLAUDE.md`](CLAUDE.md) (architecture and conventions), [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) (decisions and build plan), [`ElevateAI MVP Project Proposal.md`](<ElevateAI MVP Project Proposal.md>) (product scope).

## Getting started

Prerequisites: [Bun](https://bun.sh) and Docker.

```bash
bun install
cp server/.env.example server/.env      # then edit it, see "Environment" below
docker compose up -d db                 # PostgreSQL on host port 5433
cd server
bun run db:generate                     # generate the Prisma client
bun run db:migrate                      # apply migrations
bun run db:seed-catalog                 # skills, certifications, domains (idempotent)
bun run db:seed-admin                   # optional: needs ADMIN_EMAIL and ADMIN_PASSWORD
bun run db:seed-demo                    # optional: demo companies, jobs and candidates (dev only)
cd ..
bun run dev                             # client on :5173 and server on :4000
```

Redis is used for queues and rate limits. The server starts without it, but start one (`REDIS_URL`, default `redis://localhost:6379/0`) to get the full behaviour.

`db:seed-demo` writes the generated demo logins to the gitignored `server/seed-credentials.txt`.

## Environment

Set these in `server/.env` (see `server/.env.example`). Never commit real secrets.

| Variable | Needed | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Matches the docker-compose port 5433 in development |
| `BETTER_AUTH_SECRET` | yes | At least 32 characters |
| `REDIS_URL` | recommended | Queues and shared rate limits |
| `CLIENT_ORIGIN`, `BETTER_AUTH_URL` | production | Both are the public URL (one origin) |
| `NODE_ENV` | production | `production` turns on rate limiting and secure cookies |
| `TRUST_PROXY` | behind a proxy | Number of reverse proxies in front of the API; never `true` |
| `SMTP_URL`, `MAIL_FROM` | for real email | Without `SMTP_URL`, emails are printed to the server console |
| `REQUIRE_EMAIL_VERIFICATION` | optional | Default `true`; login is refused until the email is verified |
| `OPENAI_API_KEY`, `AI_ENABLED` | for AI | AI routes answer 503 without a key or with `AI_ENABLED=false` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional | Both or neither; the client also needs `VITE_GOOGLE_AUTH=true` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | optional | Used to create the first admin (password: 12+ characters) |

## Commands

Run from the repository root unless noted.

| Command | What it does |
|---|---|
| `bun run dev` | Client and server together (`dev:client`, `dev:server` separately) |
| `bun run build` | Build the client |
| `bun run typecheck` | Type-check the server |
| `cd client && bun run lint` | Lint the client (oxlint) |
| `cd server && bun test` | Server unit tests |
| `cd client && bun test` | Client unit tests |
| `bun run test:e2e:install` | One-time: download Playwright Chromium |
| `bun run test:e2e` | Playwright tests on an isolated stack and database |
| `bun run test:db:reset` | Clear the e2e database |

The e2e stack uses its own database (`elevateai_test`) and ports, and a stubbed AI provider, so it never touches your dev data or OpenAI.

## Deployment

- **One origin is required.** The client calls a relative `/api`, and the session cookie depends on it.
- **Single host with Docker:** `docker-compose.prod.yml` runs Caddy (serves the client and proxies `/api`), the server, PostgreSQL and Redis. Copy `server/.env.production.example` to `server/.env.production` and follow its checklist. Run migrations with `docker compose -f docker-compose.prod.yml run --rm server bun run db:deploy`.
- **Free tiers (Neon + Render + Vercel):** see [`DEPLOY-FREE.md`](DEPLOY-FREE.md) and [`render.yaml`](render.yaml). Notes that matter:
  - Vercel serves the client and rewrites `/api/*` to Render (`client/vercel.json`).
  - Put the Render web service and its Key Value (Redis) in the same region as the database.
  - Render's free plan blocks SMTP on ports 25, 465 and 587, so use a provider with another port (for example Brevo on 2525).
  - Set the Key Value eviction policy to `noeviction`.
  - Free web services sleep when idle; `.github/workflows/keepalive.yml` pings the API to reduce cold starts.

## Privacy and AI

AI features send resume or job text to OpenAI only after the user agrees, and users can withdraw consent on `/account`. The notice is on `/privacy` and needs legal review before real use.

## License

No license file has been added yet. All rights are reserved until one is chosen.
