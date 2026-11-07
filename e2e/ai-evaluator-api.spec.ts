import { expect, test } from '@playwright/test'
import { grantAiConsent, registerUser } from './support/auth'
import { profileContent, saveProfileApi } from './support/profile'

// Paths that need no model call (the success paths are in ai-evaluator-success.spec.ts).
const PATH = '/api/candidate/profile/evaluation'

test.describe('resume evaluation access', () => {
  test('rejects anonymous requests with 401', async ({ request }) => {
    expect((await request.get(PATH)).status()).toBe(401)
    expect((await request.post(PATH)).status()).toBe(401)
  })

  test('forbids employers with 403', async ({ request }) => {
    await registerUser(request, { role: 'employer' })
    expect((await request.get(PATH)).status()).toBe(403)
    expect((await request.post(PATH)).status()).toBe(403)
  })
})

test.describe('resume evaluation that need no model call', () => {
  test('GET with no saved resume returns no evaluation and the full daily allowance', async ({ request }) => {
    await registerUser(request)
    const res = await request.get(PATH)
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual({ evaluation: null, remainingToday: 5 })
  })

  test('POST with no saved resume answers 409', async ({ request }) => {
    await registerUser(request)
    await grantAiConsent(request)
    const res = await request.post(PATH)
    expect(res.status()).toBe(409)
    expect((await res.json()).error.message).toBe('Save your resume first')
  })

  test('GET with a saved resume but no review returns no evaluation', async ({ request }) => {
    await registerUser(request)
    await saveProfileApi(request, profileContent())
    const res = await request.get(PATH)
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual({ evaluation: null, remainingToday: 5 })
  })
})
