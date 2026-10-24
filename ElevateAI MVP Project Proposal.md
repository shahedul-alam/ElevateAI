**ElevateAI MVP Project Proposal & Development Specification**

**1\. Executive Summary**

The Minimum Viable Product (MVP) for ElevateAI focuses on rapidly launching a dual-sided career and recruitment ecosystem to validate product-market fit. By prioritizing core matchmaking capabilities, automated AI resume evaluations, and foundational application workflows, the MVP avoids over-engineering while delivering immediate value to both job seekers and employers.

**2\. Core MVP Objectives**

- **Empower Job Seekers:** Deliver data-backed, actionable insights through automated resume evaluation and comprehensive profile gap visualization.
- **Optimize Recruitment:** Streamline employer workflows by replacing manual screening with an intelligent job matching engine and a centralized, scored talent dashboard.
- **Streamline Discovery:** Deploy a functional job marketplace for employers to publish roles and track applicants, while providing candidates with targeted search and seamless application tools.

**3\. Technical Architecture Overview**

To ensure scalability and high performance, the MVP will be built on the following modern, modular stack designed to assist AI coding agents:

- **Frontend (Client Layer):** React.js with TypeScript and Tailwind CSS. UI components will be managed via Shadcn/ui, with Chart.js or D3.js powering the Profile Gap Visualizer. TanStack Query will handle API caching and client state, alongside React Hook Form and Zod for schema validation.
- **Backend (API Layer):** Node.js with Express and TypeScript, exposing RESTful endpoints configured with secure CORS policies.
- **Database Infrastructure:** MongoDB integrated with Mongoose ORM and Zod to handle flexible document storage for user profiles, parsed resumes, job listings, and application logs.
- **Package Manager & Tooling:** Bun will be utilized for rapid dependency resolution, script execution, and optimized build pipelines.
- **Authentication & Security:** Better Auth (supporting Email and Google OAuth) with JWT and MongoDB adapters will enforce Role-Based Access Control (RBAC) across Candidate, Employer, and Administrator accounts.
- **Background Processing:** BullMQ backed by Redis will handle asynchronous tasks (e.g., resume parsing, email dispatch), with WebSockets powering real-time dashboard notifications.
- **AI Infrastructure:** Vercel AI SDK integrated with frontier models (such as Claude and ChatGPT).
- **Infrastructure & Testing:** Hosted on Vercel for serverless API execution and edge-rendered client deployment, paired with cloud-managed Redis and MongoDB cluster environments. Playwright will facilitate automated end-to-end (E2E) testing.

**4\. MVP Functional Scope & Modules**

**Authentication & Profile Management**

- Implementation of Better Auth for secure user onboarding.
- Basic RBAC configuration strictly separating Candidate, Employer, and Admin environments.
- Foundational profile creation capabilities required for platform access.

**Module 1: Resume Evaluator**

- Designed as the primary top-of-funnel magnet to acquire job seekers.
- Features robust PDF and DOCX parsing functionality.
- Generates an AI-based hireability score (0–100), summarizes key strengths and weaknesses, and provides actionable keyword recommendations.

**Module 4: Profile Gap Visualizer**

- A multi-dimensional visual analytics tool utilizing radar charts and breakdown bars.
- Evaluates a candidate's profile against holistic job requirements, measuring gaps across technical proficiencies, total years of experience, domain/industry familiarity, leadership scope, and required certifications.
- Feeds data directly into the job matching system to provide an instant, accurate picture of true job readiness.

**Module 5: Job Matching System**

- The core value proposition bridging both sides of the marketplace.
- Calculates match scores between candidates and published job listings using a combination of Deterministic and Vector Similarity logic.

**Module 6: Job Posting Portal**

- Essential infrastructure allowing employers to supply jobs to the ecosystem.
- Features standard job listing creation, publishing mechanics, and status toggles (Active, Draft, Closed).
- Includes an integrated candidate list view for active postings.

**Module 7: Core User Dashboards**

- **Job Seeker Dashboard:** Features a candidate application tracker mapping statuses across Applied, Under Review, Rejected, and Hired states.
- **Recruiter-Facing Talent Dashboard:** Provides a streamlined list of applicants automatically sorted by their AI-generated Match Score to close the loop on application lifecycle management.

**Basic Messaging & Notifications**

- Establishes the minimal required communication loop for the platform.
- Dispatches simple status update notifications via automated emails and in-app alerts whenever a candidate's application status changes.