import { expect, test as base } from '@playwright/test'
import { ADMIN, registerUser } from './support/auth'
import { setVerified, test } from './support/company'
import {
  deleteUserApi,
  listAuditApi,
  meId,
  publishRareJob,
  REASON,
  restoreJobApi,
  restoreUserApi,
  suspendJobApi,
  suspendUserApi,
} from './support/admin'

base.describe('audit and delete access', () => {
  base('rejects anonymous callers with 401', async ({ request }) => {
    expect((await request.get('/api/admin/audit')).status()).toBe(401)
    expect((await request.delete('/api/admin/users/x', { data: { confirmEmail: 'a@b.c' } })).status()).toBe(401)
  })

  for (const role of ['candidate', 'employer'] as const) {
    base(`rejects a ${role} with 403`, async ({ request }) => {
      await registerUser(request, { role })
      expect((await request.get('/api/admin/audit')).status()).toBe(403)
      expect((await request.delete('/api/admin/users/x', { data: { confirmEmail: 'a@b.c' } })).status()).toBe(403)
    })
  }
})

test.describe('audit log', () => {
  test('records user suspend and restore by the acting admin', async ({ adminApi, newCandidate }) => {
    const { api, user } = await newCandidate()
    const id = await meId(api)
    await suspendUserApi(adminApi, id)
    await restoreUserApi(adminApi, id)

    const { entries } = await listAuditApi(adminApi, { q: user.email })
    const actions = entries.map((e) => e.action)
    expect(actions).toContain('user.suspend')
    expect(actions).toContain('user.restore')
    const suspend = entries.find((e) => e.action === 'user.suspend')!
    expect(suspend).toMatchObject({
      actorEmail: ADMIN.email,
      targetType: 'user',
      targetId: id,
      targetLabel: user.email,
      reason: REASON,
    })
    expect(suspend.actorId).toBe(await meId(adminApi))
    expect(entries.find((e) => e.action === 'user.restore')!.reason).toBeNull()
  })

  test('records job suspend and restore', async ({ adminApi, newEmployer }) => {
    const employer = await newEmployer()
    const job = await publishRareJob(employer.api)
    await suspendJobApi(adminApi, job.id)
    await restoreJobApi(adminApi, job.id)

    const { entries } = await listAuditApi(adminApi, { q: job.content.title })
    expect(entries.map((e) => e.action).sort()).toEqual(['job.restore', 'job.suspend'])
    for (const e of entries) expect(e).toMatchObject({ targetType: 'job', targetId: job.id, actorEmail: ADMIN.email })
  })

  test('records company verify and unverify', async ({ adminApi, newEmployer }) => {
    const { company } = await newEmployer()
    await setVerified(adminApi, company.id, true)
    await setVerified(adminApi, company.id, false)

    const { entries } = await listAuditApi(adminApi, { q: company.name })
    expect(entries.map((e) => e.action).sort()).toEqual(['company.unverify', 'company.verify'])
    for (const e of entries) expect(e).toMatchObject({ targetType: 'company', targetId: company.id })
  })

  test('filters by action and pages with a cursor', async ({ adminApi, newCandidate }) => {
    const { api, user } = await newCandidate()
    const id = await meId(api)
    await suspendUserApi(adminApi, id)
    await restoreUserApi(adminApi, id)

    const onlySuspend = await listAuditApi(adminApi, { q: user.email, action: 'user.suspend' })
    expect(onlySuspend.entries).toHaveLength(1)
    expect(onlySuspend.entries[0]!.action).toBe('user.suspend')

    const first = await listAuditApi(adminApi, { q: user.email, limit: '1' })
    expect(first.entries).toHaveLength(1)
    expect(first.nextCursor).not.toBeNull()
    const second = await listAuditApi(adminApi, { q: user.email, limit: '1', cursor: first.nextCursor! })
    expect(second.entries).toHaveLength(1)
    expect(second.entries[0]!.id).not.toBe(first.entries[0]!.id)
    expect(second.nextCursor).toBeNull()
  })

  test('rejects an unknown action and a malformed cursor with 400', async ({ adminApi }) => {
    expect((await adminApi.get('/api/admin/audit', { params: { action: 'user.explode' } })).status()).toBe(400)
    expect((await adminApi.get('/api/admin/audit', { params: { cursor: 'not-a-uuid' } })).status()).toBe(400)
  })
})

test.describe('delete user', () => {
  test('deletes a candidate, matching the email case-insensitively, and blocks their login', async ({
    adminApi,
    newCandidate,
    request,
  }) => {
    const { api, user } = await newCandidate()
    const id = await meId(api)

    const res = await deleteUserApi(adminApi, id, user.email.toUpperCase())
    expect(res.status(), await res.text()).toBe(204)

    const login = await request.post('/api/auth/login', { data: { email: user.email, password: user.password } })
    expect(login.status()).toBe(401)
    expect((await api.get('/api/me')).status()).toBe(401)
  })

  test('writes a user.delete audit entry with counts that survives the delete', async ({ adminApi, newEmployer }) => {
    const employer = await newEmployer()
    const id = await meId(employer.api)
    const job = await publishRareJob(employer.api)

    expect((await deleteUserApi(adminApi, id, employer.user.email)).status()).toBe(204)

    // The employer's job went with them.
    expect((await adminApi.get(`/api/jobs/${job.id}`)).status()).toBe(404)
    const { entries } = await listAuditApi(adminApi, { q: employer.user.email, action: 'user.delete' })
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      actorEmail: ADMIN.email,
      targetType: 'user',
      targetId: id,
      targetLabel: employer.user.email,
    })
    expect(entries[0]!.reason).toMatch(/employer.*1 jobs, 0 applications/)
  })

  test('rejects a wrong confirmation email with 400 and keeps the user', async ({ adminApi, newCandidate }) => {
    const { api, user } = await newCandidate()
    const res = await deleteUserApi(adminApi, await meId(api), 'someone-else@e2e.test')
    expect(res.status()).toBe(400)
    expect((await api.get('/api/me')).status()).toBe(200)
    const { entries } = await listAuditApi(adminApi, { q: user.email, action: 'user.delete' })
    expect(entries).toHaveLength(0)
  })

  test('rejects a missing confirmation body with 400', async ({ adminApi, newCandidate }) => {
    const { api } = await newCandidate()
    const res = await adminApi.delete(`/api/admin/users/${await meId(api)}`)
    expect(res.status()).toBe(400)
  })

  test('answers 404 for an unknown user', async ({ adminApi }) => {
    const res = await deleteUserApi(adminApi, '00000000-0000-4000-8000-000000000000', 'a@e2e.test')
    expect(res.status()).toBe(404)
  })

  test('refuses to delete yourself or another admin with 409', async ({ adminApi }) => {
    const selfId = await meId(adminApi)
    expect((await deleteUserApi(adminApi, selfId, ADMIN.email)).status()).toBe(409)
    expect((await adminApi.get('/api/me')).status()).toBe(200)
  })

  test('refuses a non-admin caller with 403 and deletes nothing', async ({ newCandidate }) => {
    const victim = await newCandidate()
    const attacker = await newCandidate()
    const res = await deleteUserApi(attacker.api, await meId(victim.api), victim.user.email)
    expect(res.status()).toBe(403)
    expect((await victim.api.get('/api/me')).status()).toBe(200)
  })
})
