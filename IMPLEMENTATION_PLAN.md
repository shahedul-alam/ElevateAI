# ElevateAI MVP – Implementation Plan

Source: `ElevateAI MVP Project Proposal.md`. Decisions confirmed with the product owner are in section 1.

## 1. Decisions & Scope

| Topic | Decision |
|---|---|
| Hosting | Split: React client on Vercel. Express API + BullMQ workers + WebSocket server on a persistent host (Railway/Render/Fly.io). Managed PostgreSQL with pgvector (Neon, Supabase or Railway) + Redis (Upstash or Redis Cloud). |
| Modules | In scope: Auth/RBAC, 1 Resume Evaluator, 4 Gap Visualizer, 5 Job Matching, 6 Job Portal, 7 Dashboards, Notifications. Modules 2 and 3 do not exist in the proposal, so they are deferred. |
| Database | PostgreSQL + Prisma ORM (v7, `@prisma/adapter-pg`). Migrations via `prisma migrate`. |
| Vector search | pgvector (HNSW index, cosine distance); embeddings via OpenAI `text-embedding-3-small` (1536 dims) through Vercel AI SDK. |
| Resumes | Upload only (PDF/DOCX), parsed in memory. Store extracted text + structured JSON, **not** the file. Profile-to-PDF export is post-MVP. |
| Email | Resend (default; swappable behind a `Mailer` interface). |
| Out of scope | Free-form chat/messaging, payments, admin analytics, resume builder/export, mobile apps, multi-language. |

Assumption to confirm: "Basic Messaging" means status-change email + in-app notification only, per the proposal text.

## 2. Architecture

Monorepo (Bun workspaces):

```
apps/web        React + Vite + TS + Tailwind + shadcn/ui
apps/api        Express + TS (REST + Socket.IO)
apps/worker     BullMQ processors (shares code with api)
packages/shared Zod schemas, types, constants (single source of truth)
e2e/            Playwright
```

- Zod schemas in `packages/shared` validate API requests on the server and forms on the client (React Hook Form resolver). Prisma generates DB types from `schema.prisma`; Zod schemas stay the source of truth for API/form validation, and `jsonb` columns are parsed with the shared Zod schemas at the boundary.
- Auth: Better Auth with the Prisma adapter, email+password and Google OAuth. Better Auth issues cookie sessions; JWT is only used if a stateless token is needed (e.g. the WebSocket handshake). Roles `candidate | employer | admin` live on the user row; the API enforces them via `requireRole()` middleware. Admin is seeded, never self-signup.
- Because client (Vercel) and API (other host) are on different origins, configure cross-site cookies (`SameSite=None; Secure`) or put both behind one parent domain (recommended, e.g. `app.` and `api.example.com`) and set strict CORS to that origin.
- AI: Vercel AI SDK `generateObject` with Zod output schemas for resume parsing/scoring, with a provider abstraction (Claude primary, OpenAI fallback) and per-call timeouts and retries.

## 3. Data Model (PostgreSQL / Prisma)

- Conventions: `cuid`/`uuid` string ids, `createdAt`/`updatedAt` on every table, enums for statuses and roles, `jsonb` for nested structures that are not queried individually.
- `users` (Better Auth managed): id, email, role, name.
- `candidateProfiles`: userId, headline, skills (`jsonb` of {name, years, level}), experience/education (`jsonb`), certifications[], industries[], leadershipLevel, totalYears, location, preferences, `embedding vector(1536)`, `parsedResumeId` (FK).
- `employerProfiles`: userId, company name, website, size, industry.
- `resumeEvaluations`: userId (nullable for anonymous), extractedText, structured `jsonb`, score 0–100, strengths[], weaknesses[], keywordRecs[], status enum (`queued|processing|done|failed`), createdAt, `expiresAt` for anonymous rows (purged by a scheduled BullMQ job).
- `jobs`: employerId, title, description, requirements (`jsonb`: skills[], minYears, domain, leadershipLevel, certifications[]), location, workMode, salary range, status enum (`draft|active|closed`), `embedding vector(1536)`.
- `applications`: jobId, candidateId, status enum (`applied|under_review|rejected|hired`), matchScore, matchBreakdown (`jsonb`), plus an `applicationStatusHistory` table (applicationId, from, to, at). Unique constraint on (jobId, candidateId); FKs to `jobs` and `users`.
- `notifications`: userId, type, payload, readAt.
- Indexes: jobs full-text (`tsvector` GIN, via raw migration) + (status, createdAt); applications (jobId, matchScore desc); HNSW `vector_cosine_ops` indexes on `jobs.embedding` and `candidateProfiles.embedding`.
- pgvector: the first migration runs `CREATE EXTENSION IF NOT EXISTS vector`. Prisma has no native vector type, so embedding columns are declared `Unsupported("vector(1536)")`; reads and writes go through a small `VectorStore` module using `$queryRaw`/`$executeRaw` (cast to `text` on read). Vector indexes live in hand-edited migration SQL.

## 4. Module Design

**Resume Evaluator**
1. `POST /resumes/evaluate` (multipart, 5 MB cap, MIME + magic-byte check). Works for anonymous visitors (rate limited by IP) and logged-in candidates.
2. Parse with `pdf-parse`/`unpdf` and `mammoth` (DOCX). Reject scanned/image-only PDFs with a clear message (OCR is post-MVP).
3. Enqueue BullMQ job `evaluateResume`: LLM extracts a structured profile and produces score, strengths, weaknesses, keyword recs. The rubric is fixed in the prompt (skills relevance, impact/quantification, structure, clarity, completeness) so scores are stable. Temperature low.
4. Client gets the result via WebSocket event, with polling fallback on `GET /resumes/:id`.
5. A logged-in candidate can "Apply to profile", which merges the parsed data into their profile (with review step) and generates the profile embedding.

**Profile Gap Visualizer**
- Dimensions: technical skills, years of experience, domain, leadership, certifications. Each is scored 0–100 against a job's requirements by deterministic functions (skill-set overlap weighted by level, `min(years/required,1)`, etc.).
- `GET /jobs/:id/gap` returns per-dimension scores + missing items. UI: Chart.js radar plus breakdown bars (Chart.js chosen over D3 for lower effort).

**Job Matching**
- `matchScore = 0.6 × deterministic + 0.4 × semantic`, weights in config.
  - Deterministic: weighted mean of the five gap dimensions, plus hard filters (location/work mode).
  - Semantic: cosine similarity of candidate vs. job embeddings, normalized to 0–100.
- Same function powers the gap view, the "recommended jobs" list (pgvector `ORDER BY embedding <=> $1 LIMIT N`, then re-rank deterministically), and the recruiter ranking, so numbers stay consistent. Score is computed at apply time and stored with its breakdown; recomputed by a worker when the job or profile changes materially.
- Unit tested heavily with fixtures, since it is the core value.

**Job Posting Portal**: employer CRUD with state machine `draft → active → closed` (and `active ↔ draft`); only active jobs are public; closing blocks new applications; embedding generated on publish; ownership checks on every route. Candidate list per job paginated and sorted by matchScore.

**Dashboards**
- Candidate: application tracker (four status columns/filters), recommended jobs, saved evaluation.
- Employer: jobs overview, per-job applicants sorted by matchScore with breakdown drill-down and status-change actions.
- Status transitions validated server-side (`applied → under_review → rejected|hired`), each appended to `statusHistory`.

**Notifications**: status change → enqueue `notifyStatusChange` → create in-app notification, emit Socket.IO event to the user's room, send email via Resend. Idempotent job IDs, 3 retries with backoff, failures logged without blocking the status update.

## 5. API Surface (REST, `/api/v1`)

`auth/*` (Better Auth) · `me` · `candidate/profile` · `employer/profile` · `resumes/evaluate`, `resumes/:id` · `jobs` (public list/search/filter/pagination), `jobs/:id`, `jobs/:id/gap`, `jobs/recommended` · `employer/jobs` CRUD + `status` · `jobs/:id/apply` · `candidate/applications` · `employer/jobs/:id/applicants` · `applications/:id/status` · `notifications` (+ mark read). Consistent error envelope, Zod validation on every input, cursor pagination.

## 6. Cross-Cutting Concerns

- **Security**: Helmet, strict CORS, rate limits (heavy on anonymous evaluator and auth), upload validation, role + ownership checks, no PII in logs, secrets via env, prompt-injection hardening (resume text is delimited as untrusted data; LLM output is schema-validated and never executed).
- **Cost control**: per-user/IP evaluation quotas, embedding and score caching by content hash, max input length truncation.
- **Privacy**: anonymous evaluations auto-expire (TTL 7 days); account deletion removes profile and evaluations; consent text on upload.
- **Observability**: structured logging (pino), request IDs, Sentry, BullMQ dashboard (bull-board, admin only), health endpoint.
- **AI reliability**: schema-validated outputs with one repair retry, fallback provider, and a `failed` status with a user-visible retry.

## 7. Testing Strategy

- Unit (Bun test/Vitest): scoring functions, state machine, parsers, Zod schemas.
- Integration: API routes against a real PostgreSQL (with pgvector) and Redis via Docker/Testcontainers, migrated with `prisma migrate deploy`; LLM calls mocked behind the provider interface.
- E2E (Playwright): candidate signup → upload resume → see score → apply; employer signup → post job → publish → see ranked applicant → change status → candidate sees notification. LLM stubbed via test flag.
- Small golden set of ~10 sample resumes to check the evaluator rubric for stability.

## 8. Delivery Phases

| Phase | Scope | Exit criteria |
|---|---|---|
| 0. Foundations (≈3–4d) | Monorepo, CI (lint, typecheck, test), env config, Postgres (Prisma migrations, pgvector image locally and in CI)/Redis connections, deploy skeletons for both hosts, shadcn base layout | Hello-world deployed on both hosts, CI green |
| 1. Auth & Profiles (≈4–5d) | Better Auth email + Google, roles, route guards, candidate/employer profiles | Role separation verified by tests |
| 2. Resume Evaluator (≈5–6d) | Upload, parsing, BullMQ pipeline, AI scoring, results UI, real-time updates | Anonymous + logged-in flows work end to end |
| 3. Jobs Portal (≈5d) | Employer job CRUD, status toggles, public search/filter, apply | Employer can publish; candidate can find and apply |
| 4. Matching & Gap Visualizer (≈6–7d) | Embeddings, pgvector indexes, scoring engine, radar/bars UI, recommendations | Scores consistent across gap view, recommendations, applicant list |
| 5. Dashboards & Notifications (≈4–5d) | Trackers, ranked applicant view, status workflow, email + in-app + WebSocket | Status change reaches candidate in app and email |
| 6. Hardening & Launch (≈4–5d) | Playwright suite, rate limits, security pass, load smoke test, monitoring, seed data, docs | Critical-path E2E green on staging; launch checklist done |

Estimate ≈ 7–8 weeks for one full-time developer using AI coding agents; phases 3 and 2 can overlap with two people.

## 9. Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Vercel can't host BullMQ/WebSocket | Split hosting (decided) |
| Inconsistent LLM scores erode trust | Fixed rubric, low temperature, schema output, golden-set regression test |
| Poor parsing (scanned PDFs, odd layouts) | Detect and explain failures; OCR post-MVP |
| Cold-start for matching (few jobs/candidates) | Seed realistic data; show deterministic score even without embeddings |
| AI cost abuse via the free evaluator | Quotas, rate limits, optional CAPTCHA |
| Prisma lacks a native pgvector type | `Unsupported` columns + raw SQL confined to one `VectorStore` module; revisit Prisma's pgvector extension or Drizzle if it becomes painful |

## 10. Open Items

1. Confirm domain strategy (shared parent domain for cookies) and target regions.
2. Confirm that email + in-app alerts are the full scope of "messaging".
3. Decide whether employers need approval/verification before posting jobs (assumed no for MVP, admin can suspend).
4. Define the Admin's MVP capabilities (assumed: view/suspend users and jobs only).
