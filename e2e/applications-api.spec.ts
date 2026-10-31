import { expect, test } from '@playwright/test'
import { registerUser } from './support/auth'
import { createJobApi, jobAction, newSignedInContext, publishJobApi, uniqueTitle } from './support/jobs'
import {
  applyApi,
  getGap,
  listApplicants,
  MISSING_ID,
  newCandidate,
  newEmployer,
  PROFILE_A,
  PROFILE_B,
  publishReactJob,
  publishScoredJob,
  RARE_PROFILE_ROLES,
  rareMinYears,
  reactProfile,
  recommended,
  SCORE_A,
  SCORE_B,
  setStatus,
} from './support/matching'
import { profileContent, saveProfileApi } from './support/profile'

test.describe('applications API access', () => {
  test('rejects unauthenticated requests with 401', async ({ request }) => {
    expect((await request.post(`/api/jobs/${MISSING_ID}/apply`)).status()).toBe(401)
    expect((await request.get('/api/candidate/applications')).status()).toBe(401)
    expect((await request.get(`/api/employer/jobs/${MISSING_ID}/applicants`)).status()).toBe(401)
    expect((await request.patch(`/api/applications/${MISSING_ID}/status`, { data: { status: 'hired' } })).status()).toBe(401)
  })

  test('forbids employers from candidate endpoints with 403', async ({ request }) => {
    await registerUser(request, { role: 'employer' })
    expect((await request.post(`/api/jobs/${MISSING_ID}/apply`)).status()).toBe(403)
    expect((await request.get('/api/candidate/applications')).status()).toBe(403)
  })

  test('forbids candidates from employer endpoints with 403', async ({ request }) => {
    await registerUser(request, { role: 'candidate' })
    expect((await request.get(`/api/employer/jobs/${MISSING_ID}/applicants`)).status()).toBe(403)
    expect((await request.patch(`/api/applications/${MISSING_ID}/status`, { data: { status: 'hired' } })).status()).toBe(403)
  })
})

test.describe('applying', () => {
  test('returns 404 for unknown, malformed and draft jobs', async ({ request, playwright, baseURL }) => {
    const employer = await newSignedInContext(playwright, baseURL)
    const draft = await createJobApi(employer)
    await employer.dispose()

    await registerUser(request)
    await saveProfileApi(request, profileContent())
    expect((await request.post(`/api/jobs/${MISSING_ID}/apply`)).status()).toBe(404)
    expect((await request.post('/api/jobs/not-a-uuid/apply')).status()).toBe(404)
    expect((await request.post(`/api/jobs/${draft.id}/apply`)).status()).toBe(404)
  })

  test('answers 409 when the candidate has no resume', async ({ request, playwright, baseURL }) => {
    const employer = await newSignedInContext(playwright, baseURL)
    const job = await publishReactJob(employer)
    await employer.dispose()

    await registerUser(request)
    const res = await request.post(`/api/jobs/${job.id}/apply`)
    expect(res.status()).toBe(409)
    expect((await res.json()).error.message).toBe('Build your resume to see how you match')
    expect(((await (await request.get('/api/candidate/applications')).json()).applications ?? [])).toHaveLength(0)
  })

  test('answers 409 for a closed job', async ({ request, playwright, baseURL }) => {
    const employer = await newSignedInContext(playwright, baseURL)
    const job = await publishReactJob(employer)
    expect((await jobAction(employer, job.id, 'close')).status()).toBe(200)
    await employer.dispose()

    await registerUser(request)
    await saveProfileApi(request, reactProfile(3))
    const res = await request.post(`/api/jobs/${job.id}/apply`)
    expect(res.status()).toBe(409)
    expect((await res.json()).error.message).toMatch(/closed/i)
  })

  test('creates an application with the live score, then rejects a second apply with 409', async ({
    request,
    playwright,
    baseURL,
  }) => {
    const employer = await newSignedInContext(playwright, baseURL)
    const job = await publishScoredJob(employer)
    await employer.dispose()

    await registerUser(request)
    await saveProfileApi(request, PROFILE_A)

    const res = await request.post(`/api/jobs/${job.id}/apply`)
    expect(res.status()).toBe(201)
    const { application } = await res.json()
    expect(application).toMatchObject({ status: 'applied', matchScore: SCORE_A })
    expect(typeof application.id).toBe('string')

    const again = await request.post(`/api/jobs/${job.id}/apply`)
    expect(again.status()).toBe(409)
    expect((await again.json()).error.message).toMatch(/already applied/i)

    const list = await (await request.get('/api/candidate/applications')).json()
    const mine = list.applications.filter((a: { jobId: string }) => a.jobId === job.id)
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ id: application.id, title: job.content.title, status: 'applied', matchScore: SCORE_A })
  })

  test('shows the application in the gap view and drops the job from recommendations', async ({
    request,
    playwright,
    baseURL,
  }) => {
    const employer = await newSignedInContext(playwright, baseURL)
    const job = await publishJobApi(employer, {
      title: uniqueTitle('ApplyRec'),
      skills: [{ termId: 'skill:cpp', required: true, minLevel: 3 }],
      minYears: rareMinYears(),
    })
    await employer.dispose()

    await registerUser(request)
    await saveProfileApi(request, profileContent({ skills: [{ termId: 'skill:cpp', level: 3, years: 1 }], roles: RARE_PROFILE_ROLES }))
    const expectedScore = (await getGap(request, job.id)).score

    expect((await recommended(request)).map((j) => j.id)).toContain(job.id)
    expect((await getGap(request, job.id)).application).toBeNull()

    const application = await applyApi(request, job.id)

    expect((await recommended(request)).map((j) => j.id)).not.toContain(job.id)
    const gap = await getGap(request, job.id)
    expect(gap.application).toMatchObject({ id: application.id, status: 'applied', matchScore: expectedScore })
  })
})

test.describe('frozen scores', () => {
  test('keeps the application score when the candidate edits their resume', async ({ request, playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishScoredJob(employer.ctx)

    await registerUser(request)
    await saveProfileApi(request, PROFILE_A)
    const application = await applyApi(request, job.id)
    expect(application.matchScore).toBe(SCORE_A)

    await saveProfileApi(request, PROFILE_B)
    const gap = await getGap(request, job.id)
    expect(gap.score).toBe(SCORE_B)
    expect(gap.application?.matchScore).toBe(SCORE_A)

    const list = await (await request.get('/api/candidate/applications')).json()
    expect(list.applications.find((a: { id: string }) => a.id === application.id).matchScore).toBe(SCORE_A)

    const { applicants } = await listApplicants(employer.ctx, job.id)
    expect(applicants).toHaveLength(1)
    expect(applicants[0]!.matchScore).toBe(SCORE_A)
    expect(applicants[0]!.scoredAgainstOlderVersion).toBe(false)
    await employer.ctx.dispose()
  })

  test('keeps the applicant score when the employer edits the job', async ({ request, playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishScoredJob(employer.ctx)

    await registerUser(request)
    await saveProfileApi(request, PROFILE_A)
    await applyApi(request, job.id)

    // Dropping every requirement but one that the candidate fully meets would score 100 today.
    const edit = await employer.ctx.put(`/api/employer/jobs/${job.id}`, {
      data: {
        ...job.content,
        skills: [{ termId: 'skill:react', required: true, minLevel: 1 }],
        minYears: 0,
        domainId: undefined,
        leadershipLevel: 0,
        certIds: [],
      },
    })
    expect(edit.status(), await edit.text()).toBe(200)
    expect((await getGap(request, job.id)).score).toBe(100)

    const { applicants } = await listApplicants(employer.ctx, job.id)
    expect(applicants[0]!.matchScore).toBe(SCORE_A)
    expect(applicants[0]!.scoredAgainstOlderVersion).toBe(true)
    await employer.ctx.dispose()
  })
})

test.describe('applicants', () => {
  test('ranks applicants by score, then by earlier application', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)

    // Apply order: mid (75), top1 (100), top2 (100), low (50). Expect top1, top2, mid, low.
    const mid = await newCandidate(playwright, baseURL, reactProfile(3))
    const top1 = await newCandidate(playwright, baseURL, reactProfile(4))
    const top2 = await newCandidate(playwright, baseURL, reactProfile(5))
    const low = await newCandidate(playwright, baseURL, reactProfile(2))
    for (const c of [mid, top1, top2, low]) await applyApi(c.ctx, job.id)

    const { applicants, nextCursor } = await listApplicants(employer.ctx, job.id)
    expect(nextCursor).toBeNull()
    expect(applicants.map((a) => a.candidateEmail)).toEqual([
      top1.user.email,
      top2.user.email,
      mid.user.email,
      low.user.email,
    ])
    expect(applicants.map((a) => a.matchScore)).toEqual([100, 100, 75, 50])
    expect(applicants[0]).toMatchObject({ candidateName: top1.user.name, status: 'applied', engineVersion: 'v1' })

    for (const c of [mid, top1, top2, low, employer]) await c.ctx.dispose()
  })

  test('pages through applicants with a cursor, returning each once', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const candidates = []
    for (const level of [3, 4, 2]) {
      const c = await newCandidate(playwright, baseURL, reactProfile(level))
      await applyApi(c.ctx, job.id)
      candidates.push(c)
    }

    const seen: string[] = []
    let cursor: string | null = null
    for (let i = 0; i < 5; i += 1) {
      const page = await listApplicants(employer.ctx, job.id, { limit: '1', ...(cursor && { cursor }) })
      expect(page.applicants.length).toBeLessThanOrEqual(1)
      seen.push(...page.applicants.map((a) => a.candidateEmail))
      cursor = page.nextCursor
      if (!cursor) break
    }
    expect(cursor).toBeNull()
    expect(seen).toEqual([candidates[1]!.user.email, candidates[0]!.user.email, candidates[2]!.user.email])

    for (const c of [...candidates, employer]) await c.ctx.dispose()
  })

  test('includes the breakdown with dimensions and missing names', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishScoredJob(employer.ctx)
    const candidate = await newCandidate(playwright, baseURL, PROFILE_A)
    await applyApi(candidate.ctx, job.id)

    const { applicants } = await listApplicants(employer.ctx, job.id)
    const { breakdown } = applicants[0]!
    expect(breakdown.dimensions.map((d) => [d.key, d.score])).toEqual([
      ['skills', 67],
      ['experience', 60],
      ['domain', 100],
      ['leadership', 50],
      ['certifications', 50],
    ])
    expect(breakdown.missing.skills.map((s) => s.name).sort()).toEqual(['Python', 'React'])
    expect(breakdown.missing.certs.map((c) => c.name)).toEqual(['AWS Certified Solutions Architect'])

    await candidate.ctx.dispose()
    await employer.ctx.dispose()
  })

  test("hides another employer's applicants behind 404", async ({ playwright, baseURL }) => {
    const owner = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(owner.ctx)
    const candidate = await newCandidate(playwright, baseURL, reactProfile(3))
    await applyApi(candidate.ctx, job.id)

    const other = await newEmployer(playwright, baseURL)
    expect((await other.ctx.get(`/api/employer/jobs/${job.id}/applicants`)).status()).toBe(404)
    expect((await other.ctx.get(`/api/employer/jobs/${MISSING_ID}/applicants`)).status()).toBe(404)
    expect((await other.ctx.get('/api/employer/jobs/not-a-uuid/applicants')).status()).toBe(404)

    for (const c of [owner, candidate, other]) await c.ctx.dispose()
  })

  test('validates the applicants page size', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx)
    expect((await employer.ctx.get(`/api/employer/jobs/${job.id}/applicants`, { params: { limit: '0' } })).status()).toBe(400)
    expect((await employer.ctx.get(`/api/employer/jobs/${job.id}/applicants`, { params: { cursor: 'nope' } })).status()).toBe(400)
    await employer.ctx.dispose()
  })
})

test.describe('application status', () => {
  async function setup(playwright: Parameters<typeof newEmployer>[0], baseURL: string | undefined) {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx)
    const candidate = await newCandidate(playwright, baseURL, reactProfile(3))
    const application = await applyApi(candidate.ctx, job.id)
    const status = async () =>
      (await listApplicants(employer.ctx, job.id)).applicants.find((a) => a.id === application.id)!.status
    const dispose = async () => {
      await employer.ctx.dispose()
      await candidate.ctx.dispose()
    }
    return { employer: employer.ctx, candidate: candidate.ctx, job, application, status, dispose }
  }

  test('allows applied -> under_review -> hired and shows it to the candidate', async ({ playwright, baseURL }) => {
    const s = await setup(playwright, baseURL)
    const review = await setStatus(s.employer, s.application.id, 'under_review')
    expect(review.status()).toBe(200)
    expect(await s.status()).toBe('under_review')
    expect((await setStatus(s.employer, s.application.id, 'hired')).status()).toBe(200)
    expect(await s.status()).toBe('hired')

    const list = await (await s.candidate.get('/api/candidate/applications')).json()
    expect(list.applications.find((a: { id: string }) => a.id === s.application.id).status).toBe('hired')
    await s.dispose()
  })

  test('allows rejecting from applied and from under_review', async ({ playwright, baseURL }) => {
    const first = await setup(playwright, baseURL)
    expect((await setStatus(first.employer, first.application.id, 'rejected')).status()).toBe(200)
    expect(await first.status()).toBe('rejected')
    await first.dispose()

    const second = await setup(playwright, baseURL)
    expect((await setStatus(second.employer, second.application.id, 'under_review')).status()).toBe(200)
    expect((await setStatus(second.employer, second.application.id, 'rejected')).status()).toBe(200)
    expect(await second.status()).toBe('rejected')
    await second.dispose()
  })

  test('rejects invalid transitions with 409', async ({ playwright, baseURL }) => {
    const s = await setup(playwright, baseURL)
    // applied -> hired skips review.
    expect((await setStatus(s.employer, s.application.id, 'hired')).status()).toBe(409)
    expect(await s.status()).toBe('applied')

    // rejected is final.
    await setStatus(s.employer, s.application.id, 'rejected')
    expect((await setStatus(s.employer, s.application.id, 'hired')).status()).toBe(409)
    expect((await setStatus(s.employer, s.application.id, 'under_review')).status()).toBe(409)
    expect(await s.status()).toBe('rejected')
    await s.dispose()

    // hired is final.
    const t = await setup(playwright, baseURL)
    await setStatus(t.employer, t.application.id, 'under_review')
    await setStatus(t.employer, t.application.id, 'hired')
    expect((await setStatus(t.employer, t.application.id, 'rejected')).status()).toBe(409)
    expect(await t.status()).toBe('hired')
    await t.dispose()
  })

  test('rejects "applied" and unknown statuses with 400', async ({ playwright, baseURL }) => {
    const s = await setup(playwright, baseURL)
    expect((await setStatus(s.employer, s.application.id, 'applied')).status()).toBe(400)
    expect((await setStatus(s.employer, s.application.id, 'nonsense')).status()).toBe(400)
    expect(await s.status()).toBe('applied')
    await s.dispose()
  })

  test('returns 404 for another employer and for unknown ids', async ({ playwright, baseURL }) => {
    const s = await setup(playwright, baseURL)
    const other = await newEmployer(playwright, baseURL)
    expect((await setStatus(other.ctx, s.application.id, 'under_review')).status()).toBe(404)
    expect((await setStatus(other.ctx, MISSING_ID, 'under_review')).status()).toBe(404)
    expect((await setStatus(s.employer, MISSING_ID, 'under_review')).status()).toBe(404)
    expect((await setStatus(s.employer, 'not-a-uuid', 'under_review')).status()).toBe(404)
    expect(await s.status()).toBe('applied')
    await other.ctx.dispose()
    await s.dispose()
  })
})
