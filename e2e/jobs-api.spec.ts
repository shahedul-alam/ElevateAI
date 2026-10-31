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
