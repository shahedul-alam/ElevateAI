import type { APIRequestContext } from '@playwright/test'
import { expect, getPublicCompany, jpegImage, pngImage, test, uploadImage } from './support/company'
import { CLIENT_ORIGIN, newUser } from './support/auth'
import { MISSING_ID, applyApi } from './support/matching'
import { jobAction, jobContent } from './support/jobs'
import { listNotifications } from './support/notifications'
import {
  REASON,
  jobReach,
  listAdminJobs,
  listAdminUsers,
  meId,
  publishRareJob,
  restoreJobApi,
  restoreUserApi,
  saveRareProfile,
  suspendJobApi,
  suspendUserApi,
} from './support/admin'

const ADMIN_ROUTES: { method: 'get' | 'post' | 'delete'; path: string }[] = [
  { method: 'get', path: '/api/admin/overview' },
  { method: 'get', path: '/api/admin/users' },
  { method: 'get', path: '/api/admin/jobs' },
  { method: 'post', path: `/api/admin/users/${MISSING_ID}/suspension` },
  { method: 'delete', path: `/api/admin/users/${MISSING_ID}/suspension` },
  { method: 'post', path: `/api/admin/jobs/${MISSING_ID}/suspension` },
  { method: 'delete', path: `/api/admin/jobs/${MISSING_ID}/suspension` },
]

test.describe('admin access', () => {
  for (const route of ADMIN_ROUTES) {
    const label = `${route.method.toUpperCase()} ${route.path.replace(MISSING_ID, ':id')}`
    const send = (api: APIRequestContext) =>
      api.fetch(route.path, { method: route.method, data: route.method === 'post' ? { reason: REASON } : undefined })

    test(`${label} answers 401 to anonymous visitors`, async ({ request }) => {
      expect((await send(request)).status()).toBe(401)
    })

    test(`${label} answers 403 to candidates and employers`, async ({ newCandidate, newEmployer }) => {
      expect((await send((await newCandidate()).api)).status()).toBe(403)
      expect((await send((await newEmployer()).api)).status()).toBe(403)
    })
  }
})

test.describe('overview and lists', () => {
  test('overview returns the counts', async ({ adminApi, newCandidate, newEmployer }) => {
    await newCandidate()
    await newEmployer()
    const res = await adminApi.get('/api/admin/overview')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.users.candidate).toBeGreaterThanOrEqual(1)
    expect(body.users.employer).toBeGreaterThanOrEqual(1)
    expect(body.users.admin).toBeGreaterThanOrEqual(1)
    for (const key of ['suspendedUsers', 'suspendedJobs', 'unverifiedCompanies']) {
      expect(typeof body[key]).toBe('number')
    }
    expect(typeof body.jobs).toBe('object')
  })

  test('filters users by search, role and suspended', async ({ adminApi, newCandidate, newEmployer }) => {
    const candidate = await newCandidate()
    const employer = await newEmployer()
    const suspendedId = await meId(candidate.api)
    expect((await suspendUserApi(adminApi, suspendedId)).status()).toBe(200)

    const byEmail = await listAdminUsers(adminApi, { q: candidate.user.email.toUpperCase() })
    expect(byEmail.users.map((u) => u.id)).toEqual([suspendedId])

    const employers = await listAdminUsers(adminApi, { q: employer.user.email, role: 'employer' })
    expect(employers.users.map((u) => u.email)).toEqual([employer.user.email])
    expect((await listAdminUsers(adminApi, { q: employer.user.email, role: 'candidate' })).users).toHaveLength(0)

    const suspended = await listAdminUsers(adminApi, { q: candidate.user.email, suspended: 'true' })
    expect(suspended.users).toHaveLength(1)
    expect(suspended.users[0]!.suspendedReason).toBe(REASON)
    expect((await listAdminUsers(adminApi, { q: candidate.user.email, suspended: 'false' })).users).toHaveLength(0)
    expect((await listAdminUsers(adminApi, { q: employer.user.email, suspended: 'false' })).users).toHaveLength(1)
  })

  test('pages users with a cursor', async ({ adminApi, playwright, baseURL }) => {
    const tag = `page${Date.now().toString(36)}`
    for (const n of [1, 2, 3]) {
      const ctx = await playwright.request.newContext({ baseURL })
      const user = newUser({ email: `${tag}-${n}@e2e.test` })
      expect((await ctx.post('/api/auth/register', { data: user })).status()).toBe(201)
      await ctx.dispose()
    }
    const first = await listAdminUsers(adminApi, { q: tag, limit: '2' })
    expect(first.users).toHaveLength(2)
    expect(first.nextCursor).not.toBeNull()
    const second = await listAdminUsers(adminApi, { q: tag, limit: '2', cursor: first.nextCursor! })
    expect(second.users).toHaveLength(1)
    expect(second.nextCursor).toBeNull()
    const ids = [...first.users, ...second.users].map((u) => u.id)
    expect(new Set(ids).size).toBe(3)
  })

  test('rejects an invalid role filter', async ({ adminApi }) => {
    expect((await adminApi.get('/api/admin/users', { params: { role: 'wizard' } })).status()).toBe(400)
  })

  test('filters jobs by title, status and suspended', async ({ adminApi, newEmployer }) => {
    const employer = await newEmployer()
    const live = await publishRareJob(employer.api)
    const draft = (await (await employer.api.post('/api/employer/jobs', { data: jobContent() })).json()).job
    expect((await suspendJobApi(adminApi, live.id)).status()).toBe(200)

    const byTitle = await listAdminJobs(adminApi, { q: live.content.title.toLowerCase() })
    expect(byTitle.jobs.map((j) => j.id)).toEqual([live.id])
    expect(byTitle.jobs[0]!.suspendedReason).toBe(REASON)

    expect((await listAdminJobs(adminApi, { q: live.content.title, status: 'active' })).jobs).toHaveLength(1)
    expect((await listAdminJobs(adminApi, { q: live.content.title, status: 'draft' })).jobs).toHaveLength(0)
    expect((await listAdminJobs(adminApi, { q: draft.content.title, status: 'draft' })).jobs).toHaveLength(1)
    expect((await listAdminJobs(adminApi, { q: live.content.title, suspended: 'true' })).jobs).toHaveLength(1)
    expect((await listAdminJobs(adminApi, { q: live.content.title, suspended: 'false' })).jobs).toHaveLength(0)
  })
})

test.describe('suspension validation', () => {
  test('rejects a missing, short or overlong reason', async ({ adminApi, newCandidate, newEmployer }) => {
    const userId = await meId((await newCandidate()).api)
    const job = await publishRareJob((await newEmployer()).api)
    // null, not undefined: undefined would pick up the helper's default reason.
    for (const reason of [null, '', '  ab  ', 'x'.repeat(501)]) {
      expect((await suspendUserApi(adminApi, userId, reason)).status()).toBe(400)
      expect((await suspendJobApi(adminApi, job.id, reason)).status()).toBe(400)
    }
    expect((await suspendUserApi(adminApi, userId, 'x'.repeat(500))).status()).toBe(200)
  })

  test('answers 404 for unknown ids', async ({ adminApi }) => {
    expect((await suspendUserApi(adminApi, 'no-such-user')).status()).toBe(404)
    expect((await restoreUserApi(adminApi, 'no-such-user')).status()).toBe(404)
    expect((await suspendJobApi(adminApi, MISSING_ID)).status()).toBe(404)
    expect((await restoreJobApi(adminApi, MISSING_ID)).status()).toBe(404)
    expect((await suspendJobApi(adminApi, 'not-a-uuid')).status()).toBe(404)
    expect((await restoreJobApi(adminApi, 'not-a-uuid')).status()).toBe(404)
  })
})

test.describe('suspending a user', () => {
  test('ends their session and blocks login until restored', async ({ adminApi, newCandidate, request }) => {
    const { api, user } = await newCandidate()
    const id = await meId(api)

    const res = await suspendUserApi(adminApi, id)
    expect(res.status(), await res.text()).toBe(200)
    const body = (await res.json()).user
    expect(body.suspendedAt).not.toBeNull()
    expect(body.suspendedReason).toBe(REASON)

    // The session is deleted with the suspension, so the old cookie no longer works anywhere.
    expect([401, 403]).toContain((await api.get('/api/me')).status())
    expect([401, 403]).toContain((await api.get('/api/candidate/profile')).status())

    // Login is refused with the suspension message, not the unverified-email path.
    const login = await request.post('/api/auth/login', { data: { email: user.email, password: user.password } })
    expect(login.status()).toBe(403)
    expect((await login.json()).error.message).toBe('Account suspended')
    expect((await login.json()).verificationRequired).toBeUndefined()

    expect((await restoreUserApi(adminApi, id)).status()).toBe(200)
    const again = await request.post('/api/auth/login', { data: { email: user.email, password: user.password } })
    expect(again.status(), await again.text()).toBe(200)
    expect((await request.get('/api/me')).status()).toBe(200)
  })

  test('the admin cannot suspend themselves', async ({ adminApi }) => {
    const res = await suspendUserApi(adminApi, await meId(adminApi))
    expect(res.status()).toBe(409)
    expect((await adminApi.get('/api/me')).status()).toBe(200)
  })
})

test.describe('suspending a job', () => {
  test('hides it from candidates and restores it', async ({ adminApi, newEmployer, newCandidate }) => {
    const employer = await newEmployer()
    const candidate = await newCandidate()
    await saveRareProfile(candidate.api)
    const job = await publishRareJob(employer.api)

    const before = await jobReach(candidate.api, job)
    expect(before).toMatchObject({ listed: true, detail: 200, gap: 200, recommended: true })

    const res = await suspendJobApi(adminApi, job.id)
    expect(res.status(), await res.text()).toBe(200)
    expect((await res.json()).job).toMatchObject({ id: job.id, suspendedReason: REASON })

    const hidden = await jobReach(candidate.api, job)
    expect(hidden).toEqual({ listed: false, detail: 404, gap: 404, apply: 404, recommended: false })

    expect((await restoreJobApi(adminApi, job.id)).status()).toBe(200)
    const after = await jobReach(candidate.api, job)
    expect(after).toMatchObject({ listed: true, detail: 200, gap: 200, recommended: true })
    expect((await applyApi(candidate.api, job.id)).status).toBe('applied')
  })

  test('shows the employer the reason and locks editing, but allows closing', async ({ adminApi, newEmployer }) => {
    const employer = await newEmployer()
    const job = await publishRareJob(employer.api)
    expect((await suspendJobApi(adminApi, job.id)).status()).toBe(200)

    const one = (await (await employer.api.get(`/api/employer/jobs/${job.id}`)).json()).job
    expect(one.suspendedAt).not.toBeNull()
    expect(one.suspendedReason).toBe(REASON)
    const listed = (await (await employer.api.get('/api/employer/jobs')).json()).jobs as {
      id: string
      suspendedAt: string | null
      suspendedReason: string | null
    }[]
    expect(listed.find((j) => j.id === job.id)).toMatchObject({ suspendedReason: REASON })

    const edit = await employer.api.put(`/api/employer/jobs/${job.id}`, { data: jobContent() })
    expect(edit.status()).toBe(409)
    expect((await jobAction(employer.api, job.id, 'unpublish')).status()).toBe(409)
    expect((await jobAction(employer.api, job.id, 'publish')).status()).toBe(409)
    const closed = await jobAction(employer.api, job.id, 'close')
    expect(closed.status(), await closed.text()).toBe(200)
  })

  test('rejects a double suspend and restoring a job that is not suspended', async ({ adminApi, newEmployer }) => {
    const job = await publishRareJob((await newEmployer()).api)
    expect((await restoreJobApi(adminApi, job.id)).status()).toBe(409)
    expect((await suspendJobApi(adminApi, job.id)).status()).toBe(200)
    expect((await suspendJobApi(adminApi, job.id)).status()).toBe(409)
    expect((await restoreJobApi(adminApi, job.id)).status()).toBe(200)
    expect((await restoreJobApi(adminApi, job.id)).status()).toBe(409)
  })

  test('lets the employer unpublish and edit again after a restore', async ({ adminApi, newEmployer }) => {
    const employer = await newEmployer()
    const job = await publishRareJob(employer.api)
    await suspendJobApi(adminApi, job.id)
    await restoreJobApi(adminApi, job.id)
    expect((await jobAction(employer.api, job.id, 'unpublish')).status()).toBe(200)
  })

  test('notifies the employer on suspend and on restore', async ({ adminApi, newEmployer }) => {
    const employer = await newEmployer()
    const job = await publishRareJob(employer.api)
    await suspendJobApi(adminApi, job.id, 'Duplicate listing')
    await restoreJobApi(adminApi, job.id)

    const { notifications } = await listNotifications(employer.api)
    const moderation = notifications.filter((n) => (n.type as string) === 'moderation')
    expect(moderation).toHaveLength(2)
    const suspended = moderation.find((n) => n.title === `Job suspended: ${job.content.title}`)
    expect(suspended?.body).toContain('Duplicate listing')
    expect(suspended?.link).toBe('/employer/jobs')
    expect(moderation.some((n) => n.title === `Job restored: ${job.content.title}`)).toBe(true)
  })
})

test.describe('suspending an employer', () => {
  test('hides their jobs and company, keeps candidate applications, and restores everything', async ({
    adminApi,
    newEmployer,
    newCandidate,
  }) => {
    const employer = await newEmployer()
    const candidate = await newCandidate()
    await saveRareProfile(candidate.api)
    const job = await publishRareJob(employer.api)
    const employerId = await meId(employer.api)
    const companyId = employer.company.id

    expect(await jobReach(candidate.api, job)).toMatchObject({ listed: true, recommended: true })
    expect((await getPublicCompany(candidate.api, companyId)).jobs.map((j) => j.id)).toContain(job.id)
    await applyApi(candidate.api, job.id)

    expect((await suspendUserApi(adminApi, employerId)).status()).toBe(200)

    expect(await jobReach(candidate.api, job)).toMatchObject({
      listed: false,
      detail: 404,
      gap: 404,
      apply: 404,
      recommended: false,
    })
    expect((await candidate.api.get(`/api/companies/${companyId}`)).status()).toBe(404)
    const directory = await candidate.api.get('/api/companies', { params: { q: employer.company.name } })
    expect(directory.status()).toBe(200)
    expect(((await directory.json()).companies as { id: string }[]).map((c) => c.id)).not.toContain(companyId)

    // The candidate's own application stays readable.
    const mine = await candidate.api.get('/api/candidate/applications')
    expect(mine.status()).toBe(200)
    expect(JSON.stringify(await mine.json())).toContain(job.id)

    expect((await restoreUserApi(adminApi, employerId)).status()).toBe(200)
    expect(await jobReach(candidate.api, job)).toMatchObject({ listed: true, detail: 200, gap: 200 })
    expect((await candidate.api.get(`/api/companies/${companyId}`)).status()).toBe(200)
    const back = await candidate.api.get('/api/companies', { params: { q: employer.company.name } })
    expect(((await back.json()).companies as { id: string }[]).map((c) => c.id)).toContain(companyId)
  })
})

test.describe('suspending an employer: images', () => {
  test('takes the logo and cover down (even for conditional requests) and serves them again after a restore', async ({
    adminApi,
    newEmployer,
    request,
  }) => {
    const employer = await newEmployer()
    const companyId = employer.company.id
    expect((await uploadImage(employer.api, 'logo', pngImage())).status()).toBe(200)
    expect((await uploadImage(employer.api, 'cover', jpegImage(), 'image/jpeg')).status()).toBe(200)

    const etags: Record<string, string> = {}
    for (const kind of ['logo', 'cover']) {
      const res = await request.get(`/api/companies/${companyId}/${kind}`)
      expect(res.status()).toBe(200)
      etags[kind] = res.headers()['etag']!
      expect(etags[kind]).toBeTruthy()
    }

    const employerId = await meId(employer.api)
    expect((await suspendUserApi(adminApi, employerId)).status()).toBe(200)
    for (const kind of ['logo', 'cover']) {
      const url = `/api/companies/${companyId}/${kind}`
      expect((await request.get(url)).status()).toBe(404)
      expect((await request.get(url, { headers: { 'If-None-Match': etags[kind]! } })).status()).toBe(404)
    }

    expect((await restoreUserApi(adminApi, employerId)).status()).toBe(200)
    for (const kind of ['logo', 'cover']) {
      const res = await request.get(`/api/companies/${companyId}/${kind}`)
      expect(res.status()).toBe(200)
      expect(res.headers()['etag']).toBe(etags[kind])
    }
  })
})

test.describe('protected account fields', () => {
  test('update-user cannot set suspendedAt or role', async ({ newCandidate }) => {
    const { api } = await newCandidate()
    for (const data of [{ suspendedAt: new Date().toISOString() }, { role: 'admin' }]) {
      const res = await api.post('/api/auth/update-user', { data, headers: { Origin: CLIENT_ORIGIN } })
      expect(res.status(), await res.text()).toBe(400)
    }
    expect((await api.get('/api/me')).status()).toBe(200)
  })
})
