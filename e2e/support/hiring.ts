import { expect, type APIRequestContext, type Playwright } from '@playwright/test'
import { registerUser, type TestUser } from './auth'
import { applyApi } from './matching'
import { saveProfileApi, type ProfileContent } from './profile'

export type HiringStatus =
  | 'applied'
  | 'under_review'
  | 'technical_interview'
  | 'culture_fit'
  | 'offer'
  | 'hired'
  | 'rejected'

export type HiringApplicant = {
  id: string
  jobId: string
  jobTitle: string
  rating: number | null
  noteCount: number
  photoUrl: string | null
  candidateName: string
  candidateEmail: string
  status: HiringStatus
  matchScore: number
}

/** A candidate with a chosen display name, in its own API context. */
export async function newNamedCandidate(
  playwright: Playwright,
  baseURL: string | undefined,
  name: string,
  profile?: ProfileContent,
) {
  const ctx = await playwright.request.newContext({ baseURL })
  const user: TestUser = await registerUser(ctx, { role: 'candidate', name })
  if (profile) await saveProfileApi(ctx, profile)
  return { ctx, user }
}

/** Calls the cross-job hiring list with the given query, expecting 200. */
export async function listHiring(request: APIRequestContext, params: Record<string, string> = {}) {
  const res = await request.get('/api/employer/applications', { params })
  expect(res.status(), await res.text()).toBe(200)
  return (await res.json()) as {
    applicants: HiringApplicant[]
    nextCursor: string | null
    counts: Record<HiringStatus, number>
  }
}

export async function setRatingApi(request: APIRequestContext, id: string, rating: number | null) {
  return request.patch(`/api/employer/applications/${id}/rating`, { data: { rating } })
}

export async function addNoteApi(request: APIRequestContext, id: string, body: string) {
  return request.post(`/api/employer/applications/${id}/notes`, { data: { body } })
}

export async function activityApi(request: APIRequestContext, id: string) {
  const res = await request.get(`/api/employer/applications/${id}/activity`)
  expect(res.status(), await res.text()).toBe(200)
  return (await res.json()) as {
    history: { fromStatus: HiringStatus | null; toStatus: HiringStatus; createdAt: string }[]
    notes: { id: string; body: string; createdAt: string }[]
  }
}

/** Applies a candidate to a job; returns the context and the application id. */
export async function applyCandidate(
  playwright: Playwright,
  baseURL: string | undefined,
  name: string,
  jobId: string,
  profile: ProfileContent,
) {
  const candidate = await newNamedCandidate(playwright, baseURL, name, profile)
  const application = await applyApi(candidate.ctx, jobId)
  return { ...candidate, applicationId: application.id }
}
