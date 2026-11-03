import { expect, test } from '@playwright/test'
import { registerUser } from './support/auth'
import {
  createJobApi,
  jobAction,
  jobContent,
  newSignedInContext,
  publishJobApi,
  uniqueTitle,
  type JobDto,
} from './support/jobs'
import { getGap, newCandidate, PROFILE_A, publishScoredJob, SCORE_A } from './support/matching'

const MISSING_ID = '00000000-0000-4000-8000-000000000000'

test.describe('jobs API access', () => {
  test('rejects unauthenticated employer requests with 401', async ({ request }) => {
    expect((await request.get('/api/employer/jobs')).status()).toBe(401)
    expect((await request.post('/api/employer/jobs', { data: jobContent() })).status()).toBe(401)
    expect((await request.get(`/api/employer/jobs/${MISSING_ID}`)).status()).toBe(401)
    expect((await request.put(`/api/employer/jobs/${MISSING_ID}`, { data: jobContent() })).status()).toBe(401)
    expect((await request.post(`/api/employer/jobs/${MISSING_ID}/publish`)).status()).toBe(401)
  })

  test('forbids candidates with 403', async ({ request }) => {
    await registerUser(request, { role: 'candidate' })
    expect((await request.get('/api/employer/jobs')).status()).toBe(403)
    expect((await request.post('/api/employer/jobs', { data: jobContent() })).status()).toBe(403)
    expect((await request.post(`/api/employer/jobs/${MISSING_ID}/publish`)).status()).toBe(403)
  })

  test('serves the public list and detail without logging in', async ({ request, playwright, baseURL }) => {
    const employer = await newSignedInContext(playwright, baseURL)
    const job = await publishJobApi(employer)
    await employer.dispose()

    expect((await request.get('/api/jobs')).status()).toBe(200)
    const detail = await request.get(`/api/jobs/${job.id}`)
    expect(detail.status()).toBe(200)
    expect((await detail.json()).job.content.title).toBe(job.content.title)
  })
})

test.describe('job lifecycle', () => {
  test('keeps drafts, unpublished and closed jobs out of the public API', async ({ request }) => {
    await registerUser(request, { role: 'employer' })
    const title = uniqueTitle('Lifecycle')
    const draft = await createJobApi(request, { title })
    expect(draft.status).toBe('draft')

    const publicIds = async () => {
      const res = await request.get('/api/jobs', { params: { q: title } })
      expect(res.status()).toBe(200)
      return ((await res.json()).jobs as { id: string }[]).map((j) => j.id)
    }

    expect(await publicIds()).toEqual([])
    expect((await request.get(`/api/jobs/${draft.id}`)).status()).toBe(404)

    const published = await jobAction(request, draft.id, 'publish')
    expect(published.status()).toBe(200)
    expect(((await published.json()).job as JobDto).status).toBe('active')
    expect(await publicIds()).toEqual([draft.id])
    expect((await request.get(`/api/jobs/${draft.id}`)).status()).toBe(200)

    expect((await jobAction(request, draft.id, 'unpublish')).status()).toBe(200)
    expect(await publicIds()).toEqual([])
    expect((await request.get(`/api/jobs/${draft.id}`)).status()).toBe(404)

    await jobAction(request, draft.id, 'publish')
    expect((await jobAction(request, draft.id, 'close')).status()).toBe(200)
    expect(await publicIds()).toEqual([])
    expect((await request.get(`/api/jobs/${draft.id}`)).status()).toBe(404)

    // The employer still sees it, as closed.
    const own = await request.get(`/api/employer/jobs/${draft.id}`)
    expect(((await own.json()).job as JobDto).status).toBe('closed')
  })

  test('rejects publishing a job with no scored requirement with 400', async ({ request }) => {
    await registerUser(request, { role: 'employer' })
    const job = await createJobApi(request, { skills: [] })
    const res = await jobAction(request, job.id, 'publish')
    expect(res.status()).toBe(400)
    const own = await request.get(`/api/employer/jobs/${job.id}`)
    expect(((await own.json()).job as JobDto).status).toBe('draft')
  })

  test('rejects invalid transitions with 409', async ({ request }) => {
    await registerUser(request, { role: 'employer' })

    const draft = await createJobApi(request)
    expect((await jobAction(request, draft.id, 'close')).status()).toBe(409)
    expect((await jobAction(request, draft.id, 'unpublish')).status()).toBe(409)

    const active = await publishJobApi(request)
    expect((await jobAction(request, active.id, 'publish')).status()).toBe(409)

    expect((await jobAction(request, active.id, 'close')).status()).toBe(200)
    expect((await jobAction(request, active.id, 'publish')).status()).toBe(409)
    expect((await jobAction(request, active.id, 'close')).status()).toBe(409)
    const edit = await request.put(`/api/employer/jobs/${active.id}`, {
      data: { ...active.content, title: uniqueTitle('Edited') },
    })
    expect(edit.status()).toBe(409)
  })
})

test.describe('job ownership', () => {
  test("hides another employer's job behind 404", async ({ request, playwright, baseURL }) => {
    await registerUser(request, { role: 'employer' })
    const job = await createJobApi(request)

    const other = await newSignedInContext(playwright, baseURL)
    expect((await other.get(`/api/employer/jobs/${job.id}`)).status()).toBe(404)
    expect(
      (await other.put(`/api/employer/jobs/${job.id}`, { data: { ...job.content, title: uniqueTitle() } })).status(),
    ).toBe(404)
    expect((await jobAction(other, job.id, 'publish')).status()).toBe(404)
    const list = await other.get('/api/employer/jobs')
    expect(((await list.json()).jobs as { id: string }[]).map((j) => j.id)).not.toContain(job.id)
    await other.dispose()

    // Untouched for the owner.
    const own = await request.get(`/api/employer/jobs/${job.id}`)
    const ownJob = (await own.json()).job as JobDto
    expect(ownJob.status).toBe('draft')
    expect(ownJob.content.title).toBe(job.content.title)
  })
})

test.describe('job validation', () => {
  test.beforeEach(async ({ request }) => {
    await registerUser(request, { role: 'employer' })
  })

  test('rejects unknown catalog ids with 400', async ({ request }) => {
    const bad = async (overrides: Parameters<typeof jobContent>[0]) =>
      (await request.post('/api/employer/jobs', { data: jobContent(overrides) })).status()

    expect(await bad({ skills: [{ termId: 'skill:does-not-exist', required: true, minLevel: 3 }] })).toBe(400)
    expect(await bad({ domainId: 'domain:does-not-exist' })).toBe(400)
    expect(await bad({ certIds: ['certification:does-not-exist'] })).toBe(400)
  })

  test('rejects a maximum salary below the minimum with 400', async ({ request }) => {
    const res = await request.post('/api/employer/jobs', {
      data: jobContent({ salaryMin: 100000, salaryMax: 50000 }),
    })
    expect(res.status()).toBe(400)
  })

  test('rejects an empty title and an out-of-range level with 400', async ({ request }) => {
    expect((await request.post('/api/employer/jobs', { data: jobContent({ title: '   ' }) })).status()).toBe(400)
    const res = await request.post('/api/employer/jobs', {
      data: jobContent({ skills: [{ termId: 'skill:react', required: true, minLevel: 9 }] }),
    })
    expect(res.status()).toBe(400)
  })

  test('answers 404 for malformed job ids', async ({ request }) => {
    expect((await request.get('/api/jobs/not-a-uuid')).status()).toBe(404)
    expect((await request.get('/api/jobs/not-a-uuid/')).status()).toBe(404)
    expect((await request.get('/api/employer/jobs/not-a-uuid')).status()).toBe(404)
    expect((await jobAction(request, 'not-a-uuid', 'publish')).status()).toBe(404)
    expect((await request.get(`/api/jobs/${MISSING_ID}`)).status()).toBe(404)
  })
})

test.describe('editing jobs', () => {
  test('saves edits to an active job and shows them publicly', async ({ request }) => {
    await registerUser(request, { role: 'employer' })
    const job = await publishJobApi(request)
    const newTitle = uniqueTitle('Renamed')

    const res = await request.put(`/api/employer/jobs/${job.id}`, { data: { ...job.content, title: newTitle } })
    expect(res.status(), await res.text()).toBe(200)

    const detail = await request.get(`/api/jobs/${job.id}`)
    expect((await detail.json()).job.content.title).toBe(newTitle)
    const own = await request.get(`/api/employer/jobs/${job.id}`)
    expect(((await own.json()).job as JobDto).status).toBe('active')
  })

  test('rejects editing an active job down to no requirements with 400', async ({ request }) => {
    await registerUser(request, { role: 'employer' })
    const job = await publishJobApi(request)
    const res = await request.put(`/api/employer/jobs/${job.id}`, { data: { ...job.content, skills: [] } })
    expect(res.status()).toBe(400)

    const detail = await request.get(`/api/jobs/${job.id}`)
    expect((await detail.json()).job.content.skills).toHaveLength(1)
  })

  test('allows a draft to be saved without requirements', async ({ request }) => {
    await registerUser(request, { role: 'employer' })
    const job = await createJobApi(request)
    const res = await request.put(`/api/employer/jobs/${job.id}`, { data: { ...job.content, skills: [] } })
    expect(res.status()).toBe(200)
  })
})

test.describe('public list filters', () => {
  test('matches q against the title', async ({ request }) => {
    await registerUser(request, { role: 'employer' })
    const token = uniqueTitle('Zebra')
    const match = await publishJobApi(request, { title: `${token} Engineer` })
    await publishJobApi(request, { title: uniqueTitle('Unrelated') })

    const res = await request.get('/api/jobs', { params: { q: token.toLowerCase() } })
    const ids = ((await res.json()).jobs as { id: string }[]).map((j) => j.id)
    expect(ids).toEqual([match.id])
  })

  test('filters by workMode', async ({ request }) => {
    await registerUser(request, { role: 'employer' })
    const token = uniqueTitle('Mode')
    const remote = await publishJobApi(request, { title: `${token} A`, workMode: 'remote' })
    const onsite = await publishJobApi(request, { title: `${token} B`, workMode: 'onsite' })

    const idsFor = async (workMode?: string) => {
      const res = await request.get('/api/jobs', { params: { q: token, ...(workMode && { workMode }) } })
      expect(res.status()).toBe(200)
      return ((await res.json()).jobs as { id: string }[]).map((j) => j.id).sort()
    }

    expect(await idsFor('remote')).toEqual([remote.id])
    expect(await idsFor('onsite')).toEqual([onsite.id])
    expect(await idsFor('hybrid')).toEqual([])
    expect(await idsFor()).toEqual([remote.id, onsite.id].sort())
  })

  test('rejects an invalid workMode with 400', async ({ request }) => {
    expect((await request.get('/api/jobs', { params: { workMode: 'moon' } })).status()).toBe(400)
  })

  test('paginates with limit and nextCursor, returning each job once', async ({ request }) => {
    await registerUser(request, { role: 'employer' })
    const token = uniqueTitle('Page')
    const created = [
      await publishJobApi(request, { title: `${token} 1` }),
      await publishJobApi(request, { title: `${token} 2` }),
      await publishJobApi(request, { title: `${token} 3` }),
    ]

    const seen: string[] = []
    let cursor: string | null = null
    for (let i = 0; i < 10; i += 1) {
      const res = await request.get('/api/jobs', {
        params: { q: token, limit: 1, ...(cursor && { cursor }) },
      })
      expect(res.status()).toBe(200)
      const body = (await res.json()) as { jobs: { id: string }[]; nextCursor: string | null }
      expect(body.jobs).toHaveLength(1)
      seen.push(body.jobs[0]!.id)
      cursor = body.nextCursor
      if (!cursor) break
    }

    expect(cursor).toBeNull()
    expect(seen).toHaveLength(3)
    expect([...seen].sort()).toEqual(created.map((j) => j.id).sort())
  })
})

test.describe('job post details (API)', () => {
  test.beforeEach(async ({ request }) => {
    await registerUser(request, { role: 'employer' })
  })

  test('saves and reads employment type, deadline and the four lists', async ({ request }) => {
    const job = await createJobApi(request, {
      employmentType: 'contract',
      applicationDeadline: '2027-03-15',
      responsibilities: ['Own checkout', 'Review code'],
      qualifications: ['Payments experience'],
      perks: ['25 days leave', 'Equipment budget'],
      otherDetails: ['Visa support'],
    })

    const own = await request.get(`/api/employer/jobs/${job.id}`)
    const content = ((await own.json()).job as JobDto).content
    expect(content.employmentType).toBe('contract')
    expect(content.applicationDeadline).toBe('2027-03-15')
    expect(content.responsibilities).toEqual(['Own checkout', 'Review code'])
    expect(content.qualifications).toEqual(['Payments experience'])
    expect(content.perks).toEqual(['25 days leave', 'Equipment budget'])
    expect(content.otherDetails).toEqual(['Visa support'])

    // Also visible publicly once published.
    await jobAction(request, job.id, 'publish')
    const pub = await request.get(`/api/jobs/${job.id}`)
    expect((await pub.json()).job.content.perks).toEqual(['25 days leave', 'Equipment budget'])
  })

  test('accepts every employment type', async ({ request }) => {
    for (const employmentType of ['full_time', 'part_time', 'contract', 'internship'] as const) {
      const job = await createJobApi(request, { employmentType })
      expect(job.content.employmentType).toBe(employmentType)
    }
  })

  test('keeps list order, trims items and drops repeats', async ({ request }) => {
    const job = await createJobApi(request, { responsibilities: ['  Beta ', 'Alpha', 'Beta', 'Gamma'] })
    expect(job.content.responsibilities).toEqual(['Beta', 'Alpha', 'Gamma'])
  })

  test('allows empty lists', async ({ request }) => {
    const job = await createJobApi(request, {
      responsibilities: [],
      qualifications: [],
      perks: [],
      otherDetails: [],
    })
    const own = await request.get(`/api/employer/jobs/${job.id}`)
    const content = ((await own.json()).job as JobDto).content
    expect(content.responsibilities).toEqual([])
    expect(content.perks).toEqual([])
    expect(content.employmentType).toBeUndefined()
    expect(content.applicationDeadline).toBeUndefined()
  })

  test('reads content saved without the new fields back with empty lists', async ({ request }) => {
    const res = await request.post('/api/employer/jobs', { data: jobContent() })
    expect(res.status()).toBe(201)
    const job = (await res.json()).job as JobDto
    const own = await request.get(`/api/employer/jobs/${job.id}`)
    const content = ((await own.json()).job as JobDto).content
    for (const key of ['responsibilities', 'qualifications', 'perks', 'otherDetails'] as const) {
      expect(content[key]).toEqual([])
    }
    expect(content.employmentType).toBeUndefined()
  })

  test('updates the new fields through PUT', async ({ request }) => {
    const job = await createJobApi(request, { perks: ['Old perk'] })
    const res = await request.put(`/api/employer/jobs/${job.id}`, {
      data: { ...job.content, perks: ['New perk'], employmentType: 'internship', applicationDeadline: '2027-01-31' },
    })
    expect(res.status(), await res.text()).toBe(200)
    const own = await request.get(`/api/employer/jobs/${job.id}`)
    const content = ((await own.json()).job as JobDto).content
    expect(content.perks).toEqual(['New perk'])
    expect(content.employmentType).toBe('internship')
    expect(content.applicationDeadline).toBe('2027-01-31')
  })

  test('rejects an unknown employment type with 400', async ({ request }) => {
    const res = await request.post('/api/employer/jobs', {
      data: { ...jobContent(), employmentType: 'weekends' },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects a blank list item with 400', async ({ request }) => {
    for (const key of ['responsibilities', 'qualifications', 'perks', 'otherDetails']) {
      const res = await request.post('/api/employer/jobs', { data: { ...jobContent(), [key]: ['Fine', '   '] } })
      expect(res.status(), key).toBe(400)
    }
  })

  test('allows 20 list items but rejects 21 with 400', async ({ request }) => {
    const items = (n: number) => Array.from({ length: n }, (_, i) => `Item ${i + 1}`)
    expect((await request.post('/api/employer/jobs', { data: jobContent({ perks: items(20) }) })).status()).toBe(201)
    expect((await request.post('/api/employer/jobs', { data: jobContent({ perks: items(21) }) })).status()).toBe(400)
  })

  test('rejects an over-long list item with 400', async ({ request }) => {
    const res = await request.post('/api/employer/jobs', { data: jobContent({ perks: ['x'.repeat(301)] }) })
    expect(res.status()).toBe(400)
  })

  test('rejects impossible or badly formatted deadlines with 400', async ({ request }) => {
    for (const applicationDeadline of ['2026-02-31', '2026-13-01', '2026-2-3', 'tomorrow']) {
      const res = await request.post('/api/employer/jobs', { data: { ...jobContent(), applicationDeadline } })
      expect(res.status(), applicationDeadline).toBe(400)
    }
  })

  test('rejects invalid new fields on update with 400 and keeps the old values', async ({ request }) => {
    const job = await createJobApi(request, { perks: ['Keep me'] })
    const res = await request.put(`/api/employer/jobs/${job.id}`, {
      data: { ...job.content, applicationDeadline: '2026-02-31' },
    })
    expect(res.status()).toBe(400)
    const own = await request.get(`/api/employer/jobs/${job.id}`)
    expect(((await own.json()).job as JobDto).content.perks).toEqual(['Keep me'])
  })

  test('filters the public list by employmentType', async ({ request }) => {
    const token = uniqueTitle('Type')
    const contract = await publishJobApi(request, { title: `${token} A`, employmentType: 'contract' })
    const intern = await publishJobApi(request, { title: `${token} B`, employmentType: 'internship' })
    const untyped = await publishJobApi(request, { title: `${token} C` })

    const idsFor = async (employmentType?: string) => {
      const res = await request.get('/api/jobs', { params: { q: token, ...(employmentType && { employmentType }) } })
      expect(res.status()).toBe(200)
      return ((await res.json()).jobs as { id: string }[]).map((j) => j.id).sort()
    }

    expect(await idsFor('contract')).toEqual([contract.id])
    expect(await idsFor('internship')).toEqual([intern.id])
    expect(await idsFor('part_time')).toEqual([])
    expect(await idsFor()).toEqual([contract.id, intern.id, untyped.id].sort())
  })

  test('rejects an invalid employmentType filter with 400', async ({ request }) => {
    expect((await request.get('/api/jobs', { params: { employmentType: 'weekends' } })).status()).toBe(400)
  })

  test('does not change the match score for the same candidate', async ({ request, playwright, baseURL }) => {
    const plain = await publishScoredJob(request)
    const detailed = await publishScoredJob(request, {
      employmentType: 'part_time',
      applicationDeadline: '2027-06-30',
      responsibilities: ['Lead the team'],
      qualifications: ['MBA'],
      perks: ['Free lunch'],
      otherDetails: ['Relocation help'],
    })

    const candidate = await newCandidate(playwright, baseURL, PROFILE_A)
    expect((await getGap(candidate.ctx, plain.id)).score).toBe(SCORE_A)
    expect((await getGap(candidate.ctx, detailed.id)).score).toBe(SCORE_A)

    // Editing only display fields leaves the score alone too.
    const res = await request.put(`/api/employer/jobs/${detailed.id}`, {
      data: { ...detailed.content, perks: ['Free lunch', 'Gym'], responsibilities: [] },
    })
    expect(res.status(), await res.text()).toBe(200)
    expect((await getGap(candidate.ctx, detailed.id)).score).toBe(SCORE_A)
    await candidate.ctx.dispose()
  })
})
