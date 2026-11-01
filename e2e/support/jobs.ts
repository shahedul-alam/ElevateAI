import { expect, type APIRequestContext, type Playwright } from '@playwright/test'
import { registerUser, type Role } from './auth'

export type JobContent = {
  title: string
  description: string
  skills: { termId: string; required: boolean; minLevel: number; minYears?: number }[]
  minYears: number
  domainId?: string
  minDomainYears: number
  minDegreeLevel?: number
  leadershipLevel: number
  certIds: string[]
  location?: string
  workMode?: 'onsite' | 'hybrid' | 'remote'
  salaryMin?: number
  salaryMax?: number
}

export type JobDto = {
  id: string
  status: 'draft' | 'active' | 'closed'
  content: JobContent
}

let counter = 0

export function uniqueTitle(prefix = 'E2E Job') {
  counter += 1
  return `${prefix} ${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 6)}`
}

export function jobContent(overrides: Partial<JobContent> = {}): JobContent {
  return {
    title: uniqueTitle(),
    description: 'An end-to-end test job.',
    skills: [{ termId: 'skill:react', required: true, minLevel: 3 }],
    minYears: 0,
    minDomainYears: 0,
    leadershipLevel: 0,
    certIds: [],
    ...overrides,
  }
}

/** A separate, independently signed-in API context (the default `request` can only be one user). */
export async function newSignedInContext(
  playwright: Playwright,
  baseURL: string | undefined,
  role: Role = 'employer',
) {
  const ctx = await playwright.request.newContext({ baseURL })
  await registerUser(ctx, { role })
  return ctx
}

export async function createJobApi(request: APIRequestContext, overrides: Partial<JobContent> = {}) {
  const res = await request.post('/api/employer/jobs', { data: jobContent(overrides) })
  expect(res.status(), await res.text()).toBe(201)
  return (await res.json()).job as JobDto
}

export async function jobAction(
  request: APIRequestContext,
  id: string,
  action: 'publish' | 'unpublish' | 'close',
) {
  return request.post(`/api/employer/jobs/${id}/${action}`)
}

export async function publishJobApi(request: APIRequestContext, overrides: Partial<JobContent> = {}) {
  const job = await createJobApi(request, overrides)
  const res = await jobAction(request, job.id, 'publish')
  expect(res.status(), await res.text()).toBe(200)
  return (await res.json()).job as JobDto
}
