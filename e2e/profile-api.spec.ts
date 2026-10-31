import { expect, test } from '@playwright/test'
import { registerUser } from './support/auth'
import { listVersionsApi, profileContent, saveProfileApi } from './support/profile'

test.describe('candidate profile API', () => {
  test('rejects unauthenticated requests with 401', async ({ request }) => {
    expect((await request.get('/api/candidate/profile')).status()).toBe(401)
    expect((await request.put('/api/candidate/profile', { data: profileContent() })).status()).toBe(401)
    expect((await request.get('/api/candidate/profile/versions')).status()).toBe(401)
  })

  test('forbids employers with 403', async ({ request }) => {
    await registerUser(request, { role: 'employer' })
    const res = await request.put('/api/candidate/profile', { data: profileContent() })
    expect(res.status()).toBe(403)
    expect((await request.get('/api/candidate/profile')).status()).toBe(403)
  })

  test('rejects an unknown catalog id with 400', async ({ request }) => {
    await registerUser(request)
    const res = await request.put('/api/candidate/profile', {
      data: profileContent({ skills: [{ termId: 'skill:does-not-exist', level: 3, years: 1 }] }),
    })
    expect(res.status()).toBe(400)
    expect(await listVersionsApi(request)).toEqual([])
  })

  test('rejects invalid content with 400', async ({ request }) => {
    await registerUser(request)
    const res = await request.put('/api/candidate/profile', {
      data: profileContent({ skills: [{ termId: 'skill:react', level: 9, years: 1 }] }),
    })
    expect(res.status()).toBe(400)
  })

  test('reuses the same version for identical content, even reordered', async ({ request }) => {
    await registerUser(request)
    const a = await saveProfileApi(
      request,
      profileContent({
        skills: [
          { termId: 'skill:react', level: 3, years: 2 },
          { termId: 'skill:python', level: 4, years: 3 },
        ],
      }),
    )
    const again = await saveProfileApi(
      request,
      profileContent({
        skills: [
          { termId: 'skill:python', level: 4, years: 3 },
          { termId: 'skill:react', level: 3, years: 2 },
        ],
      }),
    )
    expect(again.id).toBe(a.id)
    expect(await listVersionsApi(request)).toHaveLength(1)
  })

  test('restore repoints the current version without creating a row', async ({ request }) => {
    await registerUser(request)
    const a = await saveProfileApi(request, profileContent({ headline: 'A' }))
    const b = await saveProfileApi(request, profileContent({ headline: 'B' }))
    expect(b.id).not.toBe(a.id)

    const res = await request.post(`/api/candidate/profile/versions/${a.id}/restore`)
    expect(res.status()).toBe(200)

    const versions = await listVersionsApi(request)
    expect(versions).toHaveLength(2)
    expect(versions.find((v) => v.isCurrent)?.id).toBe(a.id)
    const profile = await (await request.get('/api/candidate/profile')).json()
    expect(profile.profile.content.headline).toBe('A')
  })

  test('returns 404 when restoring another user\'s version', async ({ request, playwright, baseURL }) => {
    await registerUser(request)
    const version = await saveProfileApi(request, profileContent())

    const other = await playwright.request.newContext({ baseURL })
    try {
      await registerUser(other)
      const res = await other.post(`/api/candidate/profile/versions/${version.id}/restore`)
      expect(res.status()).toBe(404)
      expect(await listVersionsApi(other)).toEqual([])
    } finally {
      await other.dispose()
    }
  })
})
