import { expect, type APIRequestContext, type Playwright } from '@playwright/test'
import { registerUser, type TestUser } from './auth'
import { publishJobApi, type JobContent, type JobDto } from './jobs'
import { profileContent, saveProfileApi, type ProfileContent } from './profile'

export const MISSING_ID = '00000000-0000-4000-8000-000000000000'

export type Gap = {
  jobId: string
  jobVersionId: string
  profileVersionId: string
  engineVersion: string
  score: number
  dimensions: { key: string; score: number; weight: number; applicable: boolean }[]
  missing: {
    skills: { termId: string; name: string; required: boolean }[]
    certs: { termId: string; name: string }[]
  }
  eligibility: { location: string; workMode: string; salary: string }
  application: null | { id: string; status: string; matchScore: number; createdAt: string }
}

export type Applicant = {
  id: string
  candidateName: string
  candidateEmail: string
  status: string
  matchScore: number
  engineVersion: string
  scoredAgainstOlderVersion: boolean
  breakdown: Gap['missing'] & { dimensions: Gap['dimensions'] }
}

/** A candidate in its own API context (own cookie jar), optionally with a saved resume. */
export async function newCandidate(
  playwright: Playwright,
  baseURL: string | undefined,
  profile?: ProfileContent,
) {
  const ctx = await playwright.request.newContext({ baseURL })
  const user: TestUser = await registerUser(ctx, { role: 'candidate' })
  if (profile) await saveProfileApi(ctx, profile)
  return { ctx, user }
}

export async function newEmployer(playwright: Playwright, baseURL: string | undefined) {
  const ctx = await playwright.request.newContext({ baseURL })
  const user = await registerUser(ctx, { role: 'employer' })
  return { ctx, user }
}

export async function getGap(request: APIRequestContext, jobId: string) {
  const res = await request.get(`/api/jobs/${jobId}/gap`)
  expect(res.status(), await res.text()).toBe(200)
  return (await res.json()) as Gap
}

export async function applyApi(request: APIRequestContext, jobId: string) {
  const res = await request.post(`/api/jobs/${jobId}/apply`)
  expect(res.status(), await res.text()).toBe(201)
  return (await res.json()).application as { id: string; status: string; matchScore: number }
}

export async function listApplicants(request: APIRequestContext, jobId: string, params: Record<string, string> = {}) {
  const res = await request.get(`/api/employer/jobs/${jobId}/applicants`, { params })
  expect(res.status(), await res.text()).toBe(200)
  return (await res.json()) as { applicants: Applicant[]; nextCursor: string | null }
}

export function setStatus(request: APIRequestContext, applicationId: string, status: string) {
  return request.patch(`/api/applications/${applicationId}/status`, { data: { status } })
}

export async function recommended(request: APIRequestContext, limit = 50) {
  const res = await request.get('/api/jobs/recommended', { params: { limit: String(limit) } })
  expect(res.status(), await res.text()).toBe(200)
  return (await res.json()).jobs as { id: string; title: string; score: number }[]
}

// Hand-computed fixture shared by several specs. Against SCORED_JOB:
//   skills: python (preferred, min 2) 1/2 = 50%, react (required, min 4) 3/4 = 75%
//     => (1*5000 + 2*7500) / 3 = 6666bp -> 67
//   experience: 3y of 5y = 60; domain: fintech time with no minimum = 100
//   leadership: 1 of 2 = 50; certifications: 1 of 2 = 50
//   overall = (40*6666 + 20*6000 + 15*10000 + 10*5000 + 15*5000) / 100 = 6616bp -> 66
export const SCORED_JOB: Partial<JobContent> = {
  skills: [
    { termId: 'skill:react', required: true, minLevel: 4 },
    { termId: 'skill:python', required: false, minLevel: 2 },
  ],
  minYears: 5,
  domainId: 'domain:fintech',
  leadershipLevel: 2,
  certIds: ['certification:aws-developer', 'certification:aws-solutions-architect'],
}

export const PROFILE_A = profileContent({
  headline: 'Profile A',
  skills: [
    { termId: 'skill:react', level: 3, years: 2 },
    { termId: 'skill:python', level: 1, years: 1 },
  ],
  roles: [{ title: 'Developer', years: 3, domainId: 'domain:fintech' }],
  leadershipLevel: 1,
  certIds: ['certification:aws-developer'],
})
export const SCORE_A = 66
export const DIMENSIONS_A: Record<string, number> = {
  skills: 67,
  experience: 60,
  domain: 100,
  leadership: 50,
  certifications: 50,
}

// Meets every requirement of SCORED_JOB.
export const PROFILE_B = profileContent({
  headline: 'Profile B',
  skills: [
    { termId: 'skill:react', level: 4, years: 5 },
    { termId: 'skill:python', level: 2, years: 2 },
  ],
  roles: [{ title: 'Lead', years: 6, domainId: 'domain:fintech' }],
  leadershipLevel: 2,
  certIds: ['certification:aws-developer', 'certification:aws-solutions-architect'],
})
export const SCORE_B = 100

export async function publishScoredJob(employer: APIRequestContext, overrides: Partial<JobContent> = {}): Promise<JobDto> {
  return publishJobApi(employer, { ...SCORED_JOB, ...overrides })
}

/** A single-skill job: a candidate with react level L scores min(L/minLevel, 1). */
export async function publishReactJob(employer: APIRequestContext, minLevel = 4, overrides: Partial<JobContent> = {}) {
  return publishJobApi(employer, {
    skills: [{ termId: 'skill:react', required: true, minLevel }],
    ...overrides,
  })
}

export const reactProfile = (level: number, extra: Partial<ProfileContent> = {}) =>
  profileContent({ skills: [{ termId: 'skill:react', level, years: 1 }], roles: [], ...extra })

/**
 * Recommendations rank the shared pool of active jobs and the test database is never reset between
 * runs, so jobs left by earlier runs compete with a new one. A random experience requirement (the
 * candidate must have 10 years, see `RARE_PROFILE_ROLES`) spreads scores so a fresh job is not crowded
 * out of a small result window by identical leftovers.
 */
export const RARE_PROFILE_ROLES = [{ title: 'Veteran', years: 10 }]
export const rareMinYears = () => 11 + Math.floor(Math.random() * 50)
