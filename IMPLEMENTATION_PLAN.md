# ElevateAI MVP – Implementation Plan

Source: `ElevateAI MVP Project Proposal.md`. Decisions confirmed with the product owner are in section 1.

## 1. Decisions & Scope

| Topic | Decision |
|---|---|
| Hosting | Split: React client on Vercel. Express API + BullMQ workers + WebSocket server on a persistent host (Railway/Render/Fly.io). Managed PostgreSQL with pgvector (Neon, Supabase or Railway) + Redis (Upstash or Redis Cloud). |
| Modules | In scope: Auth/RBAC, 1 Resume Evaluator, 4 Gap Visualizer, 5 Job Matching, 6 Job Portal, 7 Dashboards, Notifications. Modules 2 and 3 do not exist in the proposal, so they are deferred. |
| Database | PostgreSQL + Prisma ORM (v7, `@prisma/adapter-pg`). Migrations via `prisma migrate`. |
| Vector search | Superseded by section 1a: not part of the match score. pgvector is kept for a later retrieval-only use (embeddings via OpenAI `text-embedding-3-small`, HNSW cosine). |
| Resumes | Superseded by section 1a: candidates build their resume with forms; upload/parsing is deferred. Profile-to-PDF export is post-MVP. |
| Email | Resend (default; swappable behind a `Mailer` interface). |
| Out of scope | Free-form chat/messaging, payments, admin analytics, resume export, mobile apps, multi-language. |

Assumption to confirm: "Basic Messaging" means status-change email + in-app notification only, per the proposal text.

### 1a. Revision: form-based resumes and deterministic matching

Goal: a match score must be reproducible. If a candidate restores an earlier resume state, the score for a job returns to exactly what it was. An LLM-parsed resume or an embedding blend cannot guarantee that, so:

- **Forms, not uploads.** Candidates build the resume in a form; employers post jobs in a form. The Resume Evaluator (upload, parsing, 0-100 evaluation) is deferred and would later fill the same form model.
- **Pure scoring function.** `matchEngine(profileContent, jobContent, ENGINE_V1)` in `server/src/modules/matching/` uses no DB, clock, randomness or network. Arithmetic is integer basis points. The engine version is stored with every result; changing weights or rules means a new `ENGINE_V2`, and old scores stay as they were.
- **Dimensions and weights (fixed, global):** skills 35, experience 20, domain 15, education 10, leadership 10, certifications 10. A dimension the job does not specify is skipped and the remaining weights renormalise, so an employer who sets no degree requirement is not affected by education at all. No employer-tunable weights (scores stay comparable across jobs). Location, work mode and salary are eligibility flags next to the score, never part of it. Education was added to `ENGINE_V1` before launch (no application had been stored), so V1 was revised in place; from the first real application on, any change to weights or rules needs a new engine version.
- **Education** is scored as the candidate's highest degree level against the job's minimum (0 not required, 1 diploma/associate, 2 bachelor, 3 master, 4 doctorate): `min(highest / minimum, 1)`. Field of study is not matched.
- **Display-only fields** (shown to employers, never read by the engine): resume summary, and per role the company, dates and description; per education entry the field, institution and dates. Company is deliberately not scored (it would need a subjective company ranking), and free-text descriptions are not scored (keyword or LLM scoring would not be reproducible or would reward keyword stuffing). They are part of the content hash, so editing them creates a new profile version without changing any score. Employers see the full resume snapshot the candidate applied with, minus the candidate's personal preferences.
- **Skills** are required (weight 2) or preferred (weight 1) with a minimum level 1-5 and optional minimum years; candidates state level 1-5 plus years. Credit is `min(level/minLevel, 1)`, or 0.7 of that plus 0.3 of `min(years/minYears, 1)` when the job sets minimum years.
- **Curated catalog** (`CatalogTerm`/`CatalogAlias`, ids like `skill:react`) for skills, certifications and domains, so equivalent spellings score the same. Terms outside the catalog are kept in an `unmapped` list that the engine ignores.
- **No clock:** experience is entered as years per role, so "present" never changes a score over time.
- **Immutable versions.** `ProfileVersion` and `JobVersion` rows are content-hashed (sha256 of canonical JSON). Saving identical content reuses a version; restoring a version only repoints `currentVersionId`, so the same version always scores the same.
- **Frozen applications.** Applying stores the profile version, job version, score, breakdown and engine version. Employers see that score; the candidate's live gap view and recommendations use the current profile.
- **Contact details are not part of the versioned resume.** Phone, contact email (defaults to the account email), city and country (no street address), and LinkedIn/GitHub/website/other links live in a mutable `CandidateProfile.contact` record. They are current information: restoring an old version must not bring back an old phone number, editing them must not create a version, and they must be correctable or removable (immutable versions would keep every past value). Never scored, never in the content hash. Only employers with an applicant on their job see them, and they see the latest values, not a snapshot from application day. Links are http(s) only. The planned PDF export will combine the current contact record with the chosen resume version.
- **View, download and edit (built).** `/resume/preview` shows the resume as a formatted page for the current version or any older one, and downloads it as a PDF generated in the browser (A4, one ATS-friendly single-column layout, Helvetica; non-Latin text is warned about, not embedded). Job preferences never appear. An older version can be opened as an editable copy (`/resume?from=<id>`); saving makes a new version. For the resume to print in the order the candidate wants, roles and education keep their entered order and that order is part of the saved content (rearranging = a new version, score unchanged); sets such as skills and certifications stay sorted. Word/text/JSON exports and template choices were considered and left out of this phase.
- **Embeddings** are retrieval-only and not built yet. Recommendations currently score the newest 200 active jobs in process, best first.

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
- `candidateProfiles` + `profileVersions`: built (see 1a). One profile per user with `currentVersionId`; each version holds the content as `jsonb` (headline, summary, skills {termId, level, years}, roles {title, years, domainId, company, period, description}, education {degreeLevel, field, institution, period}, leadershipLevel, certIds, unmapped, preferences) and a `contentHash`. The original design (below) is superseded: ~~skills (`jsonb` of {name, years, level}), experience/education, certifications[], industries[], totalYears, location, `embedding vector(1536)`, `parsedResumeId`~~.
- `catalogTerms` / `catalogAliases`: built; kind `skill|certification|domain`, stable `kind:slug` ids.
- `employerProfiles`: userId, company name, website, size, industry.
- `resumeEvaluations`: userId (nullable for anonymous), extractedText, structured `jsonb`, score 0–100, strengths[], weaknesses[], keywordRecs[], status enum (`queued|processing|done|failed`), createdAt, `expiresAt` for anonymous rows (purged by a scheduled BullMQ job).
- `jobs` + `jobVersions`: built. `jobs` holds employerId, status enum (`draft|active|closed`), `currentVersionId`, `publishedAt`; each immutable version holds the post as `jsonb` (title, description, skills {termId, required, minLevel, minYears?}, minYears, domainId, minDomainYears, minDegreeLevel, leadershipLevel, certIds, location, workMode, salary range). No embedding column yet.
- `applications`: built. jobId, candidateId, `profileVersionId`, `jobVersionId`, status enum (`applied|under_review|rejected|hired`), matchScore, matchBreakdown (`jsonb`, ids only), `engineVersion`, plus an `applicationStatusHistory` table (applicationId, from, to, at). Unique constraint on (jobId, candidateId); FKs to `jobs`, `users` and the two version tables.
- `notifications`: userId, type, payload, readAt.
- Indexes: jobs full-text (`tsvector` GIN, via raw migration) + (status, createdAt); applications (jobId, matchScore desc); HNSW `vector_cosine_ops` indexes on `jobs.embedding` and `candidateProfiles.embedding`.
- pgvector: the first migration runs `CREATE EXTENSION IF NOT EXISTS vector`. Prisma has no native vector type, so embedding columns are declared `Unsupported("vector(1536)")`; reads and writes go through a small `VectorStore` module using `$queryRaw`/`$executeRaw` (cast to `text` on read). Vector indexes live in hand-edited migration SQL.

## 4. Module Design

**Resume Evaluator** (deferred, see 1a; the design below is kept for when upload is added)
1. `POST /resumes/evaluate` (multipart, 5 MB cap, MIME + magic-byte check). Works for anonymous visitors (rate limited by IP) and logged-in candidates.
2. Parse with `pdf-parse`/`unpdf` and `mammoth` (DOCX). Reject scanned/image-only PDFs with a clear message (OCR is post-MVP).
3. Enqueue BullMQ job `evaluateResume`: LLM extracts a structured profile and produces score, strengths, weaknesses, keyword recs. The rubric is fixed in the prompt (skills relevance, impact/quantification, structure, clarity, completeness) so scores are stable. Temperature low.
4. Client gets the result via WebSocket event, with polling fallback on `GET /resumes/:id`.
5. A logged-in candidate can "Apply to profile", which merges the parsed data into their profile (with review step) and generates the profile embedding.

**Profile Gap Visualizer** (built)
- Dimensions: technical skills, years of experience, domain, education, leadership, certifications, scored 0–100 by the pure engine (see 1a for the formulas).
- `GET /jobs/:id/gap` (candidate) returns the score, per-dimension scores, missing skills/certifications by name, eligibility flags and the candidate's application if any. UI: Chart.js radar (needs at least three applicable dimensions) plus breakdown bars on the job page.

**Job Matching** (built; supersedes the earlier 60/40 blend)
- `matchScore` is the weighted mean of the applicable dimensions, rounded. No semantic/embedding term.
- One function, `scoreMatch` in `matching.service.ts`, powers the gap view, the "recommended jobs" list (`GET /jobs/recommended`, jobs not yet applied to, best first, job id as tiebreak) and the score stored when applying, so numbers stay consistent. The stored score is never recomputed: it belongs to the profile and job versions captured at apply time. Applicants are ranked by it (earlier applicant, then id, break ties).
- Unit tested with fixtures: hand-computed golden values, revert invariance, order invariance, monotonicity.

**Job Posting Portal**: employer CRUD with state machine `draft → active → closed` (and `active ↔ draft`); only active jobs are public; closing blocks new applications; a post needs at least one scored requirement to be published; edits create new `JobVersion`s; ownership checks on every route. Candidate list per job paginated and sorted by matchScore.

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
| Inconsistent scores erode trust | Match scores come from a pure, versioned function over immutable content-hashed versions (see 1a); LLM scoring only returns with the deferred Resume Evaluator (fixed rubric, low temperature, schema output, golden-set regression test) |
| Poor parsing (scanned PDFs, odd layouts) | Detect and explain failures; OCR post-MVP |
| Cold-start for matching (few jobs/candidates) | Seed realistic data; show deterministic score even without embeddings |
| AI cost abuse via the free evaluator | Quotas, rate limits, optional CAPTCHA |
| Prisma lacks a native pgvector type | `Unsupported` columns + raw SQL confined to one `VectorStore` module; revisit Prisma's pgvector extension or Drizzle if it becomes painful |

## 10. Open Items

1. Confirm domain strategy (shared parent domain for cookies) and target regions.
2. Confirm that email + in-app alerts are the full scope of "messaging".
3. Decide whether employers need approval/verification before posting jobs (assumed no for MVP, admin can suspend).
4. Define the Admin's MVP capabilities (assumed: view/suspend users and jobs only).
