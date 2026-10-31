import { expect, test } from '@playwright/test'
import { registerUser } from './support/auth'
import { createJobApi, jobAction, newSignedInContext, publishJobApi, uniqueTitle } from './support/jobs'
import {
  DIMENSIONS_A,
  getGap,
  MISSING_ID,
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
} from './support/matching'
import { listVersionsApi, profileContent, saveProfileApi } from './support/profile'

test.describe('matching API access', () => {
  test('rejects unauthenticated requests with 401', async ({ request }) => {
    expect((await request.get(`/api/jobs/${MISSING_ID}/gap`)).status()).toBe(401)
    expect((await request.get('/api/jobs/recommended')).status()).toBe(401)
  })

  test('forbids employers with 403', async ({ request }) => {
    await registerUser(request, { role: 'employer' })
    expect((await request.get(`/api/jobs/${MISSING_ID}/gap`)).status()).toBe(403)
    expect((await request.get('/api/jobs/recommended')).status()).toBe(403)
  })

  test('returns 404 for unknown, malformed, draft and closed job ids', async ({ request, playwright, baseURL }) => {
    const employer = await newSignedInContext(playwright, baseURL)
    const draft = await createJobApi(employer)
    const closed = await publishJobApi(employer)
    await jobAction(employer, closed.id, 'close')
    await employer.dispose()

    await registerUser(request)
    await saveProfileApi(request, profileContent())
    expect((await request.get(`/api/jobs/${MISSING_ID}/gap`)).status()).toBe(404)
    expect((await request.get('/api/jobs/not-a-uuid/gap')).status()).toBe(404)
    expect((await request.get(`/api/jobs/${draft.id}/gap`)).status()).toBe(404)
    expect((await request.get(`/api/jobs/${closed.id}/gap`)).status()).toBe(404)
  })

  test('answers 409 when the candidate has no resume', async ({ request, playwright, baseURL }) => {
    const employer = await newSignedInContext(playwright, baseURL)
    const job = await publishReactJob(employer)
    await employer.dispose()

    await registerUser(request)
    const gap = await request.get(`/api/jobs/${job.id}/gap`)
    expect(gap.status()).toBe(409)
    expect((await gap.json()).error.message).toBe('Build your resume to see how you match')
    expect((await request.get('/api/jobs/recommended')).status()).toBe(409)
  })

  test('validates the recommended limit', async ({ request }) => {
    await registerUser(request)
    await saveProfileApi(request, profileContent())
    expect((await request.get('/api/jobs/recommended', { params: { limit: '0' } })).status()).toBe(400)
    expect((await request.get('/api/jobs/recommended', { params: { limit: '51' } })).status()).toBe(400)
  })
})

test.describe('gap score correctness', () => {
  test('returns the hand-computed score, dimensions and missing items', async ({ request, playwright, baseURL }) => {
    const employer = await newSignedInContext(playwright, baseURL)
    const job = await publishScoredJob(employer)
    await employer.dispose()

    await registerUser(request)
    const saved = await saveProfileApi(request, PROFILE_A)
    const gap = await getGap(request, job.id)

    expect(gap.jobId).toBe(job.id)
    expect(gap.profileVersionId).toBe(saved.id)
    expect(gap.engineVersion).toBe('v1')
    expect(gap.score).toBe(SCORE_A)
    expect(gap.application).toBeNull()
    expect(Object.fromEntries(gap.dimensions.map((d) => [d.key, d.score]))).toEqual(DIMENSIONS_A)
    expect(Object.fromEntries(gap.dimensions.map((d) => [d.key, d.weight]))).toEqual({
      skills: 40,
      experience: 20,
      domain: 15,
      leadership: 10,
      certifications: 15,
    })
    expect(gap.dimensions.every((d) => d.applicable)).toBe(true)

    expect(gap.missing.skills).toHaveLength(2)
    expect(gap.missing.skills).toContainEqual({ termId: 'skill:react', name: 'React', required: true })
    expect(gap.missing.skills).toContainEqual({ termId: 'skill:python', name: 'Python', required: false })
    expect(gap.missing.certs).toEqual([
      { termId: 'certification:aws-solutions-architect', name: 'AWS Certified Solutions Architect' },
    ])
  })

  test('scores a full match as 100 with nothing missing', async ({ request, playwright, baseURL }) => {
    const employer = await newSignedInContext(playwright, baseURL)
    const job = await publishScoredJob(employer)
    await employer.dispose()

    await registerUser(request)
    await saveProfileApi(request, PROFILE_B)
    const gap = await getGap(request, job.id)
    expect(gap.score).toBe(SCORE_B)
    expect(gap.missing).toEqual({ skills: [], certs: [] })
  })

  test('skips dimensions the job does not specify and renormalises', async ({ request, playwright, baseURL }) => {
    const employer = await newSignedInContext(playwright, baseURL)
    // Only skills (react min 4) apply: a level 3 candidate gets exactly 75.
    const job = await publishReactJob(employer, 4)
    await employer.dispose()

    await registerUser(request)
    await saveProfileApi(request, reactProfile(3))
    const gap = await getGap(request, job.id)
    expect(gap.score).toBe(75)
    expect(gap.dimensions.filter((d) => d.applicable).map((d) => d.key)).toEqual(['skills'])
    expect(gap.dimensions.find((d) => d.key === 'skills')?.score).toBe(75)
  })

  test('blends years into a skill credit when the job sets minYears', async ({ request, playwright, baseURL }) => {
    const employer = await newSignedInContext(playwright, baseURL)
    // level 3/3 = 100%, years 1/2 = 50% => 0.7 * 100 + 0.3 * 50 = 85
    const job = await publishJobApi(employer, {
      skills: [{ termId: 'skill:react', required: true, minLevel: 3, minYears: 2 }],
    })
    await employer.dispose()

    await registerUser(request)
    await saveProfileApi(request, profileContent({ skills: [{ termId: 'skill:react', level: 3, years: 1 }], roles: [] }))
    expect((await getGap(request, job.id)).score).toBe(85)
  })

  test('reports eligibility mismatches without changing the score', async ({ request, playwright, baseURL }) => {
    const employer = await newSignedInContext(playwright, baseURL)
    const job = await publishScoredJob(employer, {
      location: 'Berlin',
      workMode: 'onsite',
      salaryMin: 30000,
      salaryMax: 50000,
    })
    await employer.dispose()

    await registerUser(request)

    await saveProfileApi(request, PROFILE_A)
    const neutral = await getGap(request, job.id)
    expect(neutral.eligibility).toEqual({ location: 'unknown', workMode: 'unknown', salary: 'unknown' })

    await saveProfileApi(request, {
      ...PROFILE_A,
      preferences: { locations: ['Paris'], workModes: ['remote'], minSalary: 90000 },
    })
    const mismatch = await getGap(request, job.id)
    expect(mismatch.eligibility).toEqual({ location: 'mismatch', workMode: 'mismatch', salary: 'mismatch' })
    expect(mismatch.score).toBe(neutral.score)
    expect(mismatch.score).toBe(SCORE_A)

    await saveProfileApi(request, {
      ...PROFILE_A,
      preferences: { locations: ['berlin'], workModes: ['onsite'], minSalary: 40000 },
    })
    const fits = await getGap(request, job.id)
    expect(fits.eligibility).toEqual({ location: 'ok', workMode: 'ok', salary: 'ok' })
    expect(fits.score).toBe(SCORE_A)
  })
})

test.describe('reproducibility', () => {
  test('gives the same score whenever the same profile content is current', async ({ request, playwright, baseURL }) => {
    const employer = await newSignedInContext(playwright, baseURL)
    const job = await publishScoredJob(employer)
    await employer.dispose()

    await registerUser(request)
    const a = await saveProfileApi(request, PROFILE_A)
    const scoreA = (await getGap(request, job.id)).score
    expect(scoreA).toBe(SCORE_A)

    const b = await saveProfileApi(request, PROFILE_B)
    expect(b.id).not.toBe(a.id)
    const scoreB = (await getGap(request, job.id)).score
    expect(scoreB).toBe(SCORE_B)
    expect(scoreB).not.toBe(scoreA)

    // Restoring version A brings back exactly A's score.
    const restore = await request.post(`/api/candidate/profile/versions/${a.id}/restore`)
    expect(restore.status()).toBe(200)
    const restored = await getGap(request, job.id)
    expect(restored.score).toBe(scoreA)
    expect(restored.profileVersionId).toBe(a.id)

    // Back to B, then re-save A's content reordered and with a weaker duplicate skill.
    await saveProfileApi(request, PROFILE_B)
    expect((await getGap(request, job.id)).score).toBe(scoreB)
    await saveProfileApi(request, {
      ...PROFILE_A,
      skills: [...PROFILE_A.skills, { termId: 'skill:react', level: 1, years: 0 }].reverse(),
    })
    expect((await getGap(request, job.id)).score).toBe(scoreA)
    expect(await listVersionsApi(request)).toHaveLength(2)
  })

  test('returns an identical gap response on repeated reads', async ({ request, playwright, baseURL }) => {
    const employer = await newSignedInContext(playwright, baseURL)
    const job = await publishScoredJob(employer)
    await employer.dispose()

    await registerUser(request)
    await saveProfileApi(request, PROFILE_A)
    const first = await getGap(request, job.id)
    const second = await getGap(request, job.id)
    expect(second).toEqual(first)
  })
})

test.describe('recommended jobs', () => {
  test('lists jobs best score first and honours limit', async ({ request, playwright, baseURL }) => {
    const employer = await newSignedInContext(playwright, baseURL)
    const token = uniqueTitle('Rec')
    const minYears = rareMinYears()
    const make = (suffix: string, minLevel: number) =>
      publishJobApi(employer, {
        title: `${token} ${suffix}`,
        minYears,
        skills: [{ termId: 'skill:rust', required: true, minLevel }],
      })
    // A rust level 2 candidate scores 100, 50 and 40 respectively. Published in the "wrong" order.
    const low = await make('low', 5)
    const high = await make('high', 2)
    const mid = await make('mid', 4)
    await employer.dispose()

    await registerUser(request)
    await saveProfileApi(
      request,
      profileContent({ skills: [{ termId: 'skill:rust', level: 2, years: 1 }], roles: RARE_PROFILE_ROLES }),
    )

    const all = await recommended(request, 50)
    const mine = all.filter((j) => j.title.startsWith(token))
    expect(mine.map((j) => j.id)).toEqual([high.id, mid.id, low.id])
    expect(mine[0]!.score).toBeGreaterThan(mine[1]!.score)
    expect(mine[1]!.score).toBeGreaterThan(mine[2]!.score)

    const scores = all.map((j) => j.score)
    expect(scores).toEqual([...scores].sort((x, y) => y - x))

    const one = await request.get('/api/jobs/recommended', { params: { limit: '1' } })
    expect((await one.json()).jobs).toHaveLength(1)
  })

  test('returns the score, eligibility and term names for each job', async ({ request, playwright, baseURL }) => {
    const employer = await newSignedInContext(playwright, baseURL)
    // A rare skill keeps this job within the top results of the shared pool.
    const job = await publishJobApi(employer, {
      title: uniqueTitle('RecShape'),
      skills: [{ termId: 'skill:cpp', required: true, minLevel: 3 }],
      minYears: rareMinYears(),
      domainId: 'domain:fintech',
    })
    await employer.dispose()

    await registerUser(request)
    await saveProfileApi(
      request,
      profileContent({ skills: [{ termId: 'skill:cpp', level: 3, years: 1 }], roles: [{ title: 'Dev', years: 10, domainId: 'domain:fintech' }] }),
    )
    const gap = await getGap(request, job.id)
    const res = await request.get('/api/jobs/recommended', { params: { limit: '50' } })
    const body = await res.json()
    const found = body.jobs.find((j: { id: string }) => j.id === job.id)
    expect(found.score).toBe(gap.score)
    expect(found.title).toBe(job.content.title)
    expect(found.eligibility).toEqual({ location: 'unknown', workMode: 'unknown', salary: 'unknown' })
    expect(body.termNames['domain:fintech']).toBe('Fintech')
  })
})
