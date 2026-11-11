import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { ADMIN } from './auth'
import { publishJobApi, uniqueTitle, type JobContent, type JobDto } from './jobs'
import { profileContent, saveProfileApi } from './profile'
import { RARE_PROFILE_ROLES, rareMinYears, recommended } from './matching'

export const REASON = 'Misleading listing'

/** Signs the page's browser context in as the seeded admin (shares the cookie jar with page.request). */
export async function signInAdminApi(page: Page) {
  const res = await page.request.post('/api/auth/login', { data: ADMIN })
  expect(res.status(), await res.text()).toBe(200)
}

export async function meId(api: APIRequestContext) {
  const res = await api.get('/api/me')
  expect(res.status(), await res.text()).toBe(200)
  return ((await res.json()) as { user: { id: string } }).user.id
}

export const suspendUserApi = (admin: APIRequestContext, id: string, reason: unknown = REASON) =>
  admin.post(`/api/admin/users/${id}/suspension`, { data: { reason } })

export const restoreUserApi = (admin: APIRequestContext, id: string) =>
  admin.delete(`/api/admin/users/${id}/suspension`)

export const suspendJobApi = (admin: APIRequestContext, id: string, reason: unknown = REASON) =>
  admin.post(`/api/admin/jobs/${id}/suspension`, { data: { reason } })

export const restoreJobApi = (admin: APIRequestContext, id: string) =>
  admin.delete(`/api/admin/jobs/${id}/suspension`)

export const deleteUserApi = (admin: APIRequestContext, id: string, confirmEmail: unknown) =>
  admin.delete(`/api/admin/users/${id}`, { data: { confirmEmail } })

export type AuditRow = {
  id: string
  actorId: string
  actorEmail: string
  action: string
  targetType: string
  targetId: string
  targetLabel: string
  reason: string | null
}

export async function listAuditApi(admin: APIRequestContext, params: Record<string, string> = {}) {
  const res = await admin.get('/api/admin/audit', { params })
  expect(res.status(), await res.text()).toBe(200)
  return (await res.json()) as { entries: AuditRow[]; nextCursor: string | null }
}

export async function mustSucceed(res: Awaited<ReturnType<APIRequestContext['get']>>) {
  expect(res.status(), await res.text()).toBe(200)
  return res
}

export type AdminUserRow = { id: string; email: string; role: string; suspendedAt: string | null; suspendedReason: string | null }
export type AdminJobRow = { id: string; title: string; status: string; suspendedAt: string | null; suspendedReason: string | null }

export async function listAdminUsers(admin: APIRequestContext, params: Record<string, string> = {}) {
  const res = await mustSucceed(await admin.get('/api/admin/users', { params }))
  return (await res.json()) as { users: AdminUserRow[]; nextCursor: string | null }
}

export async function listAdminJobs(admin: APIRequestContext, params: Record<string, string> = {}) {
  const res = await mustSucceed(await admin.get('/api/admin/jobs', { params }))
  return (await res.json()) as { jobs: AdminJobRow[]; nextCursor: string | null }
}

/**
 * A live job whose requirement (10 years of experience) only the returned candidate profile meets, so
 * it ranks in /api/jobs/recommended even though the test database is shared (see `rareMinYears`).
 */
export async function publishRareJob(employer: APIRequestContext, overrides: Partial<JobContent> = {}) {
  return publishJobApi(employer, {
    title: uniqueTitle('Moderated'),
    minYears: rareMinYears(),
    skills: [{ termId: 'skill:rust', required: true, minLevel: 2 }],
    ...overrides,
  })
}

export const saveRareProfile = (candidate: APIRequestContext) =>
  saveProfileApi(
    candidate,
    profileContent({ skills: [{ termId: 'skill:rust', level: 3, years: 1 }], roles: RARE_PROFILE_ROLES }),
  )

/** Everything a candidate can reach for a job; true means the job is visible there. */
export async function jobReach(candidate: APIRequestContext, job: Pick<JobDto, 'id' | 'content'>) {
  const list = await mustSucceed(await candidate.get('/api/jobs', { params: { q: job.content.title } }))
  const listed = (((await list.json()) as { jobs: { id: string }[] }).jobs as { id: string }[]).some((j) => j.id === job.id)
  const detail = (await candidate.get(`/api/jobs/${job.id}`)).status()
  const gap = (await candidate.get(`/api/jobs/${job.id}/gap`)).status()
  const apply = gap === 200 ? undefined : (await candidate.post(`/api/jobs/${job.id}/apply`)).status()
  const recommendedIds = (await recommended(candidate, 50)).map((j) => j.id)
  return { listed, detail, gap, apply, recommended: recommendedIds.includes(job.id) }
}
