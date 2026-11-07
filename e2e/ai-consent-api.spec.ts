import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test'
import { CLIENT_ORIGIN, grantAiConsent, registerUser, type Role } from './support/auth'
import { MISSING_ID, newCandidate, newEmployer, publishScoredJob } from './support/matching'

// Every call here fails before the model (AI_ENABLED=false would answer 503 anyway).
const CONSENT = '/api/me/ai-consent'

const aiConsent = async (request: APIRequestContext) =>
  (await (await request.get('/api/me')).json()).user.aiConsent as boolean

async function expectConsentRefusal(res: APIResponse) {
  expect(res.status()).toBe(403)
  const { error } = await res.json()
  expect(error.message).toBe('Please accept the AI privacy notice first')
  expect(error.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'aiConsent' })]))
}

test.describe('AI consent endpoints', () => {
  test('reject anonymous requests with 401', async ({ request }) => {
    expect((await request.post(CONSENT)).status()).toBe(401)
    expect((await request.delete(CONSENT)).status()).toBe(401)
  })

  for (const role of ['candidate', 'employer'] as Role[]) {
    test(`let a ${role} agree and withdraw`, async ({ request }) => {
      await registerUser(request, { role })
      expect(await aiConsent(request)).toBe(false)

      const agree = await request.post(CONSENT)
      expect(agree.status()).toBe(200)
      expect(await agree.json()).toEqual({ aiConsent: true })
      expect(await aiConsent(request)).toBe(true)

      const withdraw = await request.delete(CONSENT)
      expect(withdraw.status()).toBe(200)
      expect(await withdraw.json()).toEqual({ aiConsent: false })
      expect(await aiConsent(request)).toBe(false)
    })
  }

  test('cannot be set through Better Auth update-user', async ({ request }) => {
    await registerUser(request)
    await request.post('/api/auth/update-user', {
      data: { aiConsentAt: new Date().toISOString(), aiConsentVersion: 1 },
      headers: { Origin: CLIENT_ORIGIN },
    })
    expect(await aiConsent(request)).toBe(false)
  })
})

test.describe('AI routes require consent', () => {
  test('resume import', async ({ request }) => {
    await registerUser(request)
    const call = () =>
      request.post('/api/candidate/profile/import', {
        data: Buffer.alloc(0),
        headers: { 'Content-Type': 'application/pdf' },
      })
    await expectConsentRefusal(await call())
    await grantAiConsent(request)
    expect((await call()).status()).toBe(415)
  })

  test('resume evaluation POST (GET stays open)', async ({ request }) => {
    const path = '/api/candidate/profile/evaluation'
    await registerUser(request)
    expect((await request.get(path)).status()).toBe(200)
    await expectConsentRefusal(await request.post(path))
    await grantAiConsent(request)
    const res = await request.post(path)
    expect(res.status()).toBe(409)
    expect((await res.json()).error.message).toBe('Save your resume first')
  })

  test('job post assistant', async ({ request }) => {
    await registerUser(request, { role: 'employer' })
    const call = () => request.post('/api/employer/jobs/ai-draft', { data: { text: 'short' } })
    await expectConsentRefusal(await call())
    await grantAiConsent(request)
    expect((await call()).status()).toBe(400)
  })

  test('gap explanation POST (GET stays open)', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishScoredJob(employer.ctx)
    const { ctx } = await newCandidate(playwright, baseURL)
    const path = `/api/jobs/${job.id}/gap/explanation`

    // The GET is not behind the consent gate: with no resume it answers the gap's own 409, never the consent 403.
    const read = await ctx.get(path)
    expect(read.status()).toBe(409)
    expect((await read.json()).error.message).toBe('Build your resume to see how you match')
    await expectConsentRefusal(await ctx.post(path))
    // The gate runs before the job lookup, so even an unknown job is refused first.
    await expectConsentRefusal(await ctx.post(`/api/jobs/${MISSING_ID}/gap/explanation`))

    await grantAiConsent(ctx)
    const res = await ctx.post(path)
    expect(res.status()).toBe(409)
    expect((await res.json()).error.message).toBe('Build your resume to see how you match')
    await ctx.dispose()
    await employer.ctx.dispose()
  })
})
