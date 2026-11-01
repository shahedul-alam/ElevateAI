import { expect, test } from '@playwright/test'
import { registerUser } from './support/auth'
import { createJobApi, jobAction, newSignedInContext, publishJobApi } from './support/jobs'
import {
  applyApi,
  getGap,
  listApplicants,
  newCandidate,
  newEmployer,
  publishReactJob,
  reactProfile,
} from './support/matching'
import { listVersionsApi, profileContent, saveProfileApi } from './support/profile'

const BACHELOR = { degreeLevel: 2 }
const DIPLOMA = { degreeLevel: 1 }
const DOCTORATE = { degreeLevel: 4 }

// React required at level 4, bachelor (2) required. A candidate with react level 3 has
// skills = 3/4 = 7500bp; applicable weights are skills 35 + education 10 = 45.
//   bachelor/doctorate: education 10000 -> (35*7500 + 10*10000) / 45 = 362500 / 45 = 8055bp -> 81
//   diploma:            education  5000 -> (35*7500 + 10* 5000) / 45 = 312500 / 45 = 6944bp -> 69
//   none:               education     0 -> (35*7500 + 10*    0) / 45 = 262500 / 45 = 5833bp -> 58
const degreeJob = (employer: Parameters<typeof publishJobApi>[0]) =>
  publishJobApi(employer, {
    skills: [{ termId: 'skill:react', required: true, minLevel: 4 }],
    minDegreeLevel: 2,
  })

const educationOf = (gap: Awaited<ReturnType<typeof getGap>>) => gap.dimensions.find((d) => d.key === 'education')!

test.describe('education scoring', () => {
  const cases = [
    { name: 'a bachelor', education: [BACHELOR], dimension: 100, score: 81 },
    { name: 'only a diploma', education: [DIPLOMA], dimension: 50, score: 69 },
    { name: 'no education', education: [], dimension: 0, score: 58 },
    { name: 'a doctorate (capped at 100)', education: [DOCTORATE], dimension: 100, score: 81 },
    { name: 'several entries, highest first', education: [DOCTORATE, DIPLOMA, BACHELOR], dimension: 100, score: 81 },
    { name: 'several entries, highest last', education: [DIPLOMA, DIPLOMA, BACHELOR], dimension: 100, score: 81 },
  ]

  for (const c of cases) {
    test(`scores ${c.name} against a bachelor requirement`, async ({ request, playwright, baseURL }) => {
      const employer = await newSignedInContext(playwright, baseURL)
      const job = await degreeJob(employer)
      await employer.dispose()

      await registerUser(request)
      await saveProfileApi(request, reactProfile(3, { education: c.education }))
      const gap = await getGap(request, job.id)

      expect(educationOf(gap)).toEqual({ key: 'education', score: c.dimension, weight: 10, applicable: true })
      expect(gap.dimensions.find((d) => d.key === 'skills')?.score).toBe(75)
      expect(gap.dimensions.filter((d) => d.applicable).map((d) => d.key)).toEqual(['skills', 'education'])
      expect(gap.dimensions).toHaveLength(6)
      expect(gap.score).toBe(c.score)
    })
  }

  test('skips education and ignores the candidate degree when the job sets none', async ({ request, playwright, baseURL }) => {
    const employer = await newSignedInContext(playwright, baseURL)
    // skills only: react 3/4 = 75
    const job = await publishReactJob(employer, 4)
    await employer.dispose()

    await registerUser(request)
    await saveProfileApi(request, reactProfile(3, { education: [] }))
    const without = await getGap(request, job.id)
    await saveProfileApi(request, reactProfile(3, { education: [DOCTORATE] }))
    const withDegree = await getGap(request, job.id)

    for (const gap of [without, withDegree]) {
      expect(educationOf(gap)).toMatchObject({ applicable: false })
      expect(gap.score).toBe(75)
    }
    expect(withDegree.profileVersionId).not.toBe(without.profileVersionId)
  })

  test('scores a degree-only job from the degree alone', async ({ request, playwright, baseURL }) => {
    const employer = await newSignedInContext(playwright, baseURL)
    const job = await publishJobApi(employer, { skills: [], minDegreeLevel: 3 })
    await employer.dispose()

    // Only education applies: master required (3). Bachelor = 2/3 = 6666bp -> 67; master -> 100.
    await registerUser(request)
    await saveProfileApi(request, profileContent({ skills: [], roles: [], education: [BACHELOR] }))
    const bachelor = await getGap(request, job.id)
    expect(bachelor.dimensions.filter((d) => d.applicable).map((d) => d.key)).toEqual(['education'])
    expect(bachelor.score).toBe(67)
    expect(educationOf(bachelor).score).toBe(67)

    await saveProfileApi(request, profileContent({ skills: [], roles: [], education: [{ degreeLevel: 3 }] }))
    expect((await getGap(request, job.id)).score).toBe(100)
  })

  test('publishes a degree-only job but still refuses a job with nothing scored', async ({ request }) => {
    await registerUser(request, { role: 'employer' })

    const degreeOnly = await createJobApi(request, { skills: [], minDegreeLevel: 2 })
    const ok = await jobAction(request, degreeOnly.id, 'publish')
    expect(ok.status(), await ok.text()).toBe(200)

    const empty = await createJobApi(request, { skills: [], minDegreeLevel: 0 })
    expect((await jobAction(request, empty.id, 'publish')).status()).toBe(400)
  })

  test('defaults the minimum degree to 0 and stores a chosen one', async ({ request }) => {
    await registerUser(request, { role: 'employer' })
    const none = await createJobApi(request)
    expect(none.content.minDegreeLevel ?? 0).toBe(0)
    const master = await createJobApi(request, { minDegreeLevel: 3 })
    expect(master.content.minDegreeLevel).toBe(3)
  })
})

test.describe('education and resume validation', () => {
  for (const degreeLevel of [0, 5]) {
    test(`rejects a profile degreeLevel of ${degreeLevel} with 400`, async ({ request }) => {
      await registerUser(request)
      const res = await request.put('/api/candidate/profile', {
        data: profileContent({ education: [{ degreeLevel }] }),
      })
      expect(res.status()).toBe(400)
      expect(await listVersionsApi(request)).toEqual([])
    })
  }

  test('rejects more than 10 education entries with 400', async ({ request }) => {
    await registerUser(request)
    const res = await request.put('/api/candidate/profile', {
      data: profileContent({ education: Array.from({ length: 11 }, () => ({ degreeLevel: 2 })) }),
    })
    expect(res.status()).toBe(400)
  })

  for (const minDegreeLevel of [5, -1]) {
    test(`rejects a job minDegreeLevel of ${minDegreeLevel} with 400`, async ({ request }) => {
      await registerUser(request, { role: 'employer' })
      const res = await request.post('/api/employer/jobs', {
        data: {
          title: 'Bad degree',
          description: 'x',
          skills: [{ termId: 'skill:react', required: true, minLevel: 3 }],
          minYears: 0,
          minDomainYears: 0,
          leadershipLevel: 0,
          certIds: [],
          minDegreeLevel,
        },
      })
      expect(res.status()).toBe(400)
    })
  }

  test('rejects an over-length summary and role description with 400, accepts the limit', async ({ request }) => {
    await registerUser(request)
    const put = (content: ReturnType<typeof profileContent>) => request.put('/api/candidate/profile', { data: content })

    expect((await put(profileContent({ summary: 'a'.repeat(2001) }))).status()).toBe(400)
    expect(
      (await put(profileContent({ roles: [{ title: 'Dev', years: 1, description: 'a'.repeat(2001) }] }))).status(),
    ).toBe(400)
    expect(
      (await put(profileContent({ roles: [{ title: 'Dev', years: 1, company: 'c'.repeat(101) }] }))).status(),
    ).toBe(400)

    const ok = await put(
      profileContent({
        summary: 'a'.repeat(2000),
        roles: [{ title: 'Dev', years: 1, description: 'b'.repeat(2000) }],
      }),
    )
    expect(ok.status(), await ok.text()).toBe(200)
  })
})

test.describe('versioning of display-only fields', () => {
  const base = () =>
    profileContent({
      summary: 'Original summary',
      roles: [{ title: 'Developer', years: 3, domainId: 'domain:fintech', company: 'Acme', description: 'Original description' }],
      education: [BACHELOR],
    })

  test('creates a new version with an unchanged score when only the text changes, and restores the old text', async ({
    request,
    playwright,
    baseURL,
  }) => {
    const employer = await newSignedInContext(playwright, baseURL)
    const job = await publishReactJob(employer, 4)
    await employer.dispose()

    await registerUser(request)
    const first = await saveProfileApi(request, base())
    const firstGap = await getGap(request, job.id)
    expect(await listVersionsApi(request)).toHaveLength(1)

    const summaryChanged = await saveProfileApi(request, { ...base(), summary: 'Edited summary' })
    expect(summaryChanged.id).not.toBe(first.id)
    expect(await listVersionsApi(request)).toHaveLength(2)

    const descriptionChanged = await saveProfileApi(request, {
      ...base(),
      summary: 'Edited summary',
      roles: [{ ...base().roles[0]!, description: 'Edited description' }],
    })
    expect(descriptionChanged.id).not.toBe(summaryChanged.id)
    expect(await listVersionsApi(request)).toHaveLength(3)

    const latestGap = await getGap(request, job.id)
    expect(latestGap.profileVersionId).toBe(descriptionChanged.id)
    expect(latestGap.score).toBe(firstGap.score)
    expect(latestGap.dimensions).toEqual(firstGap.dimensions)

    const restore = await request.post(`/api/candidate/profile/versions/${first.id}/restore`)
    expect(restore.status()).toBe(200)
    const { profile } = await (await request.get('/api/candidate/profile')).json()
    expect(profile.content.summary).toBe('Original summary')
    expect(profile.content.roles[0].description).toBe('Original description')
    expect(await listVersionsApi(request)).toHaveLength(3)
  })

  test('reuses the version when education entries are re-saved in a different order', async ({ request }) => {
    await registerUser(request)
    const entries = [
      { degreeLevel: 2, field: 'Computer Science', institution: 'State University', period: '2015 - 2019' },
      { degreeLevel: 3, field: 'AI', institution: 'Tech Institute', period: '2019 - 2021' },
      { degreeLevel: 1, field: 'Math', institution: 'Community College', period: '2013 - 2015' },
    ]
    const a = await saveProfileApi(request, profileContent({ education: entries }))
    const b = await saveProfileApi(request, profileContent({ education: [...entries].reverse() }))
    const c = await saveProfileApi(request, profileContent({ education: [entries[1]!, entries[2]!, entries[0]!] }))
    expect(b.id).toBe(a.id)
    expect(c.id).toBe(a.id)
    expect(await listVersionsApi(request)).toHaveLength(1)
  })

  test('creates a new version when education content changes', async ({ request }) => {
    await registerUser(request)
    const a = await saveProfileApi(request, profileContent({ education: [{ degreeLevel: 2, field: 'CS' }] }))
    const b = await saveProfileApi(request, profileContent({ education: [{ degreeLevel: 2, field: 'Physics' }] }))
    expect(b.id).not.toBe(a.id)
  })

  test('produces one version for same-titled roles saved in either order', async ({ request }) => {
    await registerUser(request)
    const one = { title: 'Engineer', years: 2, description: 'Built the billing system' }
    const two = { title: 'Engineer', years: 2, description: 'Ran the on-call rotation' }
    const a = await saveProfileApi(request, profileContent({ roles: [one, two] }))
    const b = await saveProfileApi(request, profileContent({ roles: [two, one] }))
    expect(b.id).toBe(a.id)
    expect(await listVersionsApi(request)).toHaveLength(1)
  })
})

test.describe('applicant resume snapshot', () => {
  test('shows the resume as it was at apply time, with names resolved and no preferences', async ({
    request,
    playwright,
    baseURL,
  }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 3)

    await registerUser(request)
    await saveProfileApi(request, {
      headline: 'Snapshot headline',
      summary: 'Original summary text',
      skills: [
        { termId: 'skill:react', level: 4, years: 3 },
        { termId: 'skill:python', level: 2, years: 1 },
      ],
      roles: [
        {
          title: 'Backend developer',
          years: 2.5,
          domainId: 'domain:fintech',
          company: 'Acme Corp',
          period: 'Jan 2020 - Jun 2022',
          description: 'Original role description',
        },
      ],
      education: [{ degreeLevel: 2, field: 'Computer Science', institution: 'State University', period: '2015 - 2019' }],
      leadershipLevel: 1,
      certIds: ['certification:aws-developer'],
      unmapped: [],
      preferences: { locations: ['Atlantis'], workModes: ['remote'], minSalary: 123456 },
    })
    await applyApi(request, job.id)

    await saveProfileApi(request, {
      headline: 'Changed headline',
      summary: 'Edited summary text',
      skills: [{ termId: 'skill:react', level: 5, years: 9 }],
      roles: [{ title: 'Manager', years: 9, company: 'Other Co', description: 'Edited role description' }],
      education: [{ degreeLevel: 4, field: 'Physics', institution: 'Other University', period: '2000' }],
      leadershipLevel: 3,
      certIds: [],
      unmapped: [],
      preferences: { locations: ['Atlantis'], workModes: ['remote'], minSalary: 123456 },
    })

    const { applicants } = await listApplicants(employer.ctx, job.id)
    expect(applicants).toHaveLength(1)
    const { resume } = applicants[0]!
    expect(resume).toEqual({
      headline: 'Snapshot headline',
      summary: 'Original summary text',
      leadershipLevel: 1,
      skills: [
        { name: 'Python', level: 2, years: 1 },
        { name: 'React', level: 4, years: 3 },
      ],
      roles: [
        {
          title: 'Backend developer',
          company: 'Acme Corp',
          period: 'Jan 2020 - Jun 2022',
          years: 2.5,
          domain: 'Fintech',
          description: 'Original role description',
        },
      ],
      education: [{ degreeLevel: 2, field: 'Computer Science', institution: 'State University', period: '2015 - 2019' }],
      certifications: ['AWS Certified Developer'],
    })

    // The candidate's private preferences never reach the employer.
    const raw = JSON.stringify(applicants[0])
    for (const leaked of ['preferences', 'minSalary', 'workModes', 'locations', 'Atlantis', '123456']) {
      expect(raw).not.toContain(leaked)
    }
    await employer.ctx.dispose()
  })

  test('includes the education dimension in the applicant breakdown', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await degreeJob(employer.ctx)
    const candidate = await newCandidate(playwright, baseURL, reactProfile(3, { education: [DIPLOMA] }))
    await applyApi(candidate.ctx, job.id)

    const { applicants } = await listApplicants(employer.ctx, job.id)
    expect(applicants[0]!.matchScore).toBe(69)
    expect(applicants[0]!.breakdown.dimensions.map((d) => [d.key, d.score, d.applicable])).toEqual([
      ['skills', 75, true],
      ['experience', 0, false],
      ['domain', 0, false],
      ['education', 50, true],
      ['leadership', 0, false],
      ['certifications', 0, false],
    ])
    await candidate.ctx.dispose()
    await employer.ctx.dispose()
  })
})
