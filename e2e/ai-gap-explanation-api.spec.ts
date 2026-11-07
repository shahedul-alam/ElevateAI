import { expect, test, type APIRequestContext } from '@playwright/test'
import { grantAiConsent, registerUser } from './support/auth'
import { createJobApi, jobAction } from './support/jobs'
import { MISSING_ID, newCandidate, newEmployer, PROFILE_A, publishScoredJob } from './support/matching'

// Never POST for a candidate with a resume and an active job: that reaches the real model.
const url = (id: string) => `/api/jobs/${id}/gap/explanation`
const both = (request: APIRequestContext, id: string) => [request.get(url(id)), request.post(url(id))]

test.describe('gap explanation access', () => {
  test('rejects anonymous requests with 401', async ({ request }) => {
    for (const res of await Promise.all(both(request, MISSING_ID))) expect(res.status()).toBe(401)
  })

  test('forbids employers with 403', async ({ request }) => {
    await registerUser(request, { role: 'employer' })
    for (const res of await Promise.all(both(request, MISSING_ID))) expect(res.status()).toBe(403)
  })

  test('returns 404 for a non-UUID id', async ({ playwright, baseURL }) => {
    const { ctx } = await newCandidate(playwright, baseURL, PROFILE_A)
    await grantAiConsent(ctx)
    for (const res of await Promise.all(both(ctx, 'not-a-uuid'))) expect(res.status()).toBe(404)
    await ctx.dispose()
  })
})

test.describe('gap explanation lookups', () => {
  test('returns 404 for an unknown job', async ({ playwright, baseURL }) => {
    const { ctx } = await newCandidate(playwright, baseURL, PROFILE_A)
    await grantAiConsent(ctx)
    for (const res of await Promise.all(both(ctx, MISSING_ID))) expect(res.status()).toBe(404)
    await ctx.dispose()
  })

  test('returns 404 for a draft job and for a closed job', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const draftJob = await createJobApi(employer.ctx)
    const closedJob = await publishScoredJob(employer.ctx)
    expect((await jobAction(employer.ctx, closedJob.id, 'close')).status()).toBe(200)

    const { ctx } = await newCandidate(playwright, baseURL, PROFILE_A)
    await grantAiConsent(ctx)
    for (const id of [draftJob.id, closedJob.id]) {
      for (const res of await Promise.all(both(ctx, id))) expect(res.status()).toBe(404)
    }
    await ctx.dispose()
    await employer.ctx.dispose()
  })

  test('returns 409 for a candidate without a resume', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishScoredJob(employer.ctx)
    const { ctx } = await newCandidate(playwright, baseURL)
    await grantAiConsent(ctx)

    for (const res of await Promise.all(both(ctx, job.id))) {
      expect(res.status()).toBe(409)
      expect((await res.json()).error.message).toBe('Build your resume to see how you match')
    }
    await ctx.dispose()
    await employer.ctx.dispose()
  })

  test('checks the job before the resume: unknown job gives 404 even without a resume', async ({ playwright, baseURL }) => {
    const { ctx } = await newCandidate(playwright, baseURL)
    await grantAiConsent(ctx)
    expect((await ctx.get(url(MISSING_ID))).status()).toBe(404)
    expect((await ctx.post(url(MISSING_ID))).status()).toBe(404)
    await ctx.dispose()
  })

  test('GET returns no explanation and the full daily allowance without calling the model', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishScoredJob(employer.ctx)
    const { ctx } = await newCandidate(playwright, baseURL, PROFILE_A)

    const res = await ctx.get(url(job.id))
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual({ explanation: null, remainingToday: 20 })
    await ctx.dispose()
    await employer.ctx.dispose()
  })
})
