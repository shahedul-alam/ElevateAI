import { expect, test } from '@playwright/test'
import { listHiring, newNamedCandidate } from './support/hiring'
import { getGap, listApplicants, newEmployer, publishReactJob, reactProfile } from './support/matching'

// The e2e servers run with AI_ENABLED=false, so no summary is ever written: these specs cover the
// contract around the field (null for employers, absent for candidates), never generated text.

test.describe('applicant summary API', () => {
  test('employer endpoints return summary as null when none is generated', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const candidate = await newNamedCandidate(playwright, baseURL, 'Ada Lovelace', reactProfile(3))
    const res = await candidate.ctx.post(`/api/jobs/${job.id}/apply`)
    expect(res.status(), await res.text()).toBe(201)
    const applicationId = (await res.json()).application.id as string

    const perJob = (await listApplicants(employer.ctx, job.id)).applicants
    expect(perJob).toHaveLength(1)
    expect(perJob[0]).toHaveProperty('summary', null)

    const hiring = (await listHiring(employer.ctx, { jobId: job.id })).applicants
    expect(hiring.map((a) => a.id)).toEqual([applicationId])
    expect(hiring[0]).toHaveProperty('summary', null)

    await employer.ctx.dispose()
    await candidate.ctx.dispose()
  })

  test('apply response keeps its shape and never carries a summary', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const candidate = await newNamedCandidate(playwright, baseURL, 'Grace Hopper', reactProfile(4))

    const res = await candidate.ctx.post(`/api/jobs/${job.id}/apply`)
    expect(res.status(), await res.text()).toBe(201)
    const body = await res.json()
    expect(Object.keys(body)).toEqual(['application'])
    expect(body.application).toMatchObject({ status: 'applied', matchScore: 100 })
    expect(body.application).not.toHaveProperty('summary')

    await employer.ctx.dispose()
    await candidate.ctx.dispose()
  })

  test('candidate endpoints never expose a summary', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const candidate = await newNamedCandidate(playwright, baseURL, 'Alan Turing', reactProfile(2))
    const apply = await candidate.ctx.post(`/api/jobs/${job.id}/apply`)
    expect(apply.status(), await apply.text()).toBe(201)

    const listRes = await candidate.ctx.get('/api/candidate/applications')
    expect(listRes.status(), await listRes.text()).toBe(200)
    const listText = await listRes.text()
    const items = (JSON.parse(listText) as { applications: Record<string, unknown>[] }).applications
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) expect(item).not.toHaveProperty('summary')
    expect(listText).not.toContain('"summary"')

    // The gap response embeds the candidate's application; it must not leak the summary either.
    const gap = await getGap(candidate.ctx, job.id)
    expect(gap.application).not.toBeNull()
    expect(gap.application).not.toHaveProperty('summary')

    await employer.ctx.dispose()
    await candidate.ctx.dispose()
  })
})
