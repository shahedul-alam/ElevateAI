import { expect, test, type APIRequestContext, type Playwright } from '@playwright/test'
import { registerUser } from './support/auth'
import { publishReactJob, MISSING_ID, newEmployer, reactProfile, setStatus } from './support/matching'
import {
  activityApi,
  addNoteApi,
  applyCandidate,
  listHiring,
  setRatingApi,
  type HiringStatus,
} from './support/hiring'
import { uniqueTitle } from './support/jobs'

const ALL_STATUSES: HiringStatus[] = [
  'applied',
  'under_review',
  'technical_interview',
  'culture_fit',
  'offer',
  'hired',
  'rejected',
]

const dispose = (...contexts: APIRequestContext[]) => Promise.all(contexts.map((c) => c.dispose()))

/** An employer with one react job (min level 4) and three applicants scoring 75, 100 and 50. */
async function setupPool(playwright: Playwright, baseURL: string | undefined) {
  const employer = await newEmployer(playwright, baseURL)
  const job = await publishReactJob(employer.ctx, 4)
  const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))
  const grace = await applyCandidate(playwright, baseURL, 'Grace Hopper', job.id, reactProfile(4))
  const alan = await applyCandidate(playwright, baseURL, 'Alan Turing', job.id, reactProfile(2))
  return { employer, job, ada, grace, alan }
}

type Pool = Awaited<ReturnType<typeof setupPool>>

async function disposePool(pool: Pool) {
  await dispose(pool.employer.ctx, pool.ada.ctx, pool.grace.ctx, pool.alan.ctx)
}

test.describe('hiring API access', () => {
  test('rejects unauthenticated requests with 401', async ({ request }) => {
    expect((await request.get('/api/employer/applications')).status()).toBe(401)
    expect((await request.get(`/api/employer/applications/${MISSING_ID}/activity`)).status()).toBe(401)
    expect((await request.patch(`/api/employer/applications/${MISSING_ID}/rating`, { data: { rating: 3 } })).status()).toBe(401)
    expect((await request.post(`/api/employer/applications/${MISSING_ID}/notes`, { data: { body: 'x' } })).status()).toBe(401)
    expect((await request.delete(`/api/employer/applications/${MISSING_ID}/notes/${MISSING_ID}`)).status()).toBe(401)
  })

  test('forbids candidates from every hiring endpoint with 403', async ({ request }) => {
    await registerUser(request, { role: 'candidate' })
    expect((await request.get('/api/employer/applications')).status()).toBe(403)
    expect((await request.get(`/api/employer/applications/${MISSING_ID}/activity`)).status()).toBe(403)
    expect((await request.patch(`/api/employer/applications/${MISSING_ID}/rating`, { data: { rating: 3 } })).status()).toBe(403)
    expect((await request.post(`/api/employer/applications/${MISSING_ID}/notes`, { data: { body: 'x' } })).status()).toBe(403)
  })
})

test.describe('hiring list', () => {
  test("lists only the employer's own applicants, across their jobs", async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    const second = await publishReactJob(pool.employer.ctx, 2, { title: uniqueTitle('Second job') })
    const dana = await applyCandidate(playwright, baseURL, 'Dana Other', second.id, reactProfile(3))

    const other = await newEmployer(playwright, baseURL)
    const otherJob = await publishReactJob(other.ctx, 4)
    const outsider = await applyCandidate(playwright, baseURL, 'Outsider Person', otherJob.id, reactProfile(5))

    const { applicants } = await listHiring(pool.employer.ctx)
    expect(applicants.map((a) => a.candidateName).sort()).toEqual(['Ada Lovelace', 'Alan Turing', 'Dana Other', 'Grace Hopper'])
    expect(applicants.map((a) => a.candidateName)).not.toContain('Outsider Person')
    expect(applicants.find((a) => a.candidateName === 'Dana Other')).toMatchObject({ jobId: second.id, jobTitle: second.content.title })

    await dispose(other.ctx, outsider.ctx, dana.ctx)
    await disposePool(pool)
  })

  test('returns a count for every stage, zeros included, for the whole employer', async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    await setStatus(pool.employer.ctx, pool.ada.applicationId, 'under_review')
    await setStatus(pool.employer.ctx, pool.grace.applicationId, 'rejected')

    const { counts } = await listHiring(pool.employer.ctx)
    expect(Object.keys(counts).sort()).toEqual([...ALL_STATUSES].sort())
    expect(counts).toMatchObject({ applied: 1, under_review: 1, rejected: 1, technical_interview: 0, hired: 0 })
    await disposePool(pool)
  })

  test('filters by status but keeps the counts for every stage', async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    await setStatus(pool.employer.ctx, pool.ada.applicationId, 'under_review')

    const page = await listHiring(pool.employer.ctx, { status: 'under_review' })
    expect(page.applicants.map((a) => a.candidateName)).toEqual(['Ada Lovelace'])
    expect(page.counts).toMatchObject({ applied: 2, under_review: 1 })
    await disposePool(pool)
  })

  test('filters by job, by minimum rating and by name, case-insensitively', async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    const second = await publishReactJob(pool.employer.ctx, 2, { title: uniqueTitle('Filter job') })
    const dana = await applyCandidate(playwright, baseURL, 'Dana Other', second.id, reactProfile(3))
    await setRatingApi(pool.employer.ctx, pool.grace.applicationId, 5)
    await setRatingApi(pool.employer.ctx, pool.ada.applicationId, 3)

    const byJob = await listHiring(pool.employer.ctx, { jobId: second.id })
    expect(byJob.applicants.map((a) => a.candidateName)).toEqual(['Dana Other'])

    const byRating = await listHiring(pool.employer.ctx, { minRating: '4' })
    expect(byRating.applicants.map((a) => a.candidateName)).toEqual(['Grace Hopper'])

    const byName = await listHiring(pool.employer.ctx, { q: 'hopper' })
    expect(byName.applicants.map((a) => a.candidateName)).toEqual(['Grace Hopper'])

    // Counts follow the job, rating and name filters.
    expect(byName.counts.applied).toBe(1)

    await dispose(dana.ctx)
    await disposePool(pool)
  })

  test('treats blank filters as unset', async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    const page = await listHiring(pool.employer.ctx, { status: '', jobId: '', q: '', minRating: '' })
    expect(page.applicants).toHaveLength(3)
    await disposePool(pool)
  })

  test('orders by match score, best first', async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    const { applicants } = await listHiring(pool.employer.ctx)
    expect(applicants.map((a) => a.matchScore)).toEqual([100, 75, 50])
    expect(applicants[0]).toMatchObject({ candidateName: 'Grace Hopper', rating: null, noteCount: 0, status: 'applied' })
    await disposePool(pool)
  })

  test('validates the filters and paging with 400', async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    for (const params of [
      { status: 'nope' },
      { minRating: '6' },
      { minRating: '0' },
      { jobId: 'abc' },
      { limit: '0' },
      { cursor: 'nope' },
    ]) {
      const res = await pool.employer.ctx.get('/api/employer/applications', { params })
      expect(res.status(), JSON.stringify(params)).toBe(400)
    }
    await disposePool(pool)
  })

  test('pages through applicants with a cursor, returning each once', async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    const seen: string[] = []
    let cursor: string | null = null
    for (let i = 0; i < 5; i += 1) {
      const page = await listHiring(pool.employer.ctx, { limit: '1', ...(cursor && { cursor }) })
      expect(page.applicants.length).toBeLessThanOrEqual(1)
      seen.push(...page.applicants.map((a) => a.candidateName))
      cursor = page.nextCursor
      if (!cursor) break
    }
    expect(cursor).toBeNull()
    expect(seen).toEqual(['Grace Hopper', 'Ada Lovelace', 'Alan Turing'])
    await disposePool(pool)
  })
})

test.describe('pipeline stages', () => {
  test('moves through every stage in order and records each change', async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    const id = pool.ada.applicationId
    const stages = ['under_review', 'technical_interview', 'culture_fit', 'offer', 'hired'] as const
    for (const stage of stages) {
      const res = await setStatus(pool.employer.ctx, id, stage)
      expect(res.status(), await res.text()).toBe(200)
      expect((await res.json()).application).toEqual({ id, status: stage })
    }

    const { history } = await activityApi(pool.employer.ctx, id)
    expect(history.map((h) => h.toStatus)).toEqual(['applied', ...stages])
    expect(history.map((h) => h.fromStatus)).toEqual([null, 'applied', 'under_review', 'technical_interview', 'culture_fit', 'offer'])

    // The candidate sees the final stage.
    const mine = await (await pool.ada.ctx.get('/api/candidate/applications')).json()
    expect(mine.applications.find((a: { id: string }) => a.id === id).status).toBe('hired')
    await disposePool(pool)
  })

  test('lets a stage be skipped', async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    expect((await setStatus(pool.employer.ctx, pool.ada.applicationId, 'offer')).status()).toBe(200)
    expect((await setStatus(pool.employer.ctx, pool.ada.applicationId, 'hired')).status()).toBe(200)
    expect((await setStatus(pool.employer.ctx, pool.grace.applicationId, 'hired')).status()).toBe(200)
    await disposePool(pool)
  })

  test('rejects from every stage before hired', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const paths: [string, string[]][] = [
      ['applied', []],
      ['under_review', ['under_review']],
      ['technical_interview', ['under_review', 'technical_interview']],
      ['culture_fit', ['under_review', 'technical_interview', 'culture_fit']],
      ['offer', ['under_review', 'technical_interview', 'culture_fit', 'offer']],
    ]
    const candidates = []
    for (const [stage, path] of paths) {
      const c = await applyCandidate(playwright, baseURL, `Reject from ${stage}`, job.id, reactProfile(3))
      candidates.push(c)
      for (const step of path) expect((await setStatus(employer.ctx, c.applicationId, step)).status()).toBe(200)
      const res = await setStatus(employer.ctx, c.applicationId, 'rejected')
      expect(res.status(), `reject from ${stage}`).toBe(200)
    }
    const { counts } = await listHiring(employer.ctx)
    expect(counts.rejected).toBe(paths.length)
    await dispose(employer.ctx, ...candidates.map((c) => c.ctx))
  })

  test('rejects backward moves, the same stage and applied with 400 or 409', async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    const id = pool.ada.applicationId
    await setStatus(pool.employer.ctx, id, 'offer')

    const backward = await setStatus(pool.employer.ctx, id, 'under_review')
    expect(backward.status()).toBe(409)
    expect((await backward.json()).error.message).toMatch(/from offer to under_review/)
    expect((await setStatus(pool.employer.ctx, id, 'offer')).status()).toBe(409)
    expect((await setStatus(pool.employer.ctx, id, 'applied')).status()).toBe(400)

    const { history } = await activityApi(pool.employer.ctx, id)
    expect(history.map((h) => h.toStatus)).toEqual(['applied', 'offer'])
    await disposePool(pool)
  })

  test('keeps hired and rejected final', async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    await setStatus(pool.employer.ctx, pool.ada.applicationId, 'hired')
    expect((await setStatus(pool.employer.ctx, pool.ada.applicationId, 'offer')).status()).toBe(409)
    expect((await setStatus(pool.employer.ctx, pool.ada.applicationId, 'rejected')).status()).toBe(409)

    await setStatus(pool.employer.ctx, pool.grace.applicationId, 'rejected')
    const res = await setStatus(pool.employer.ctx, pool.grace.applicationId, 'hired')
    expect(res.status()).toBe(409)
    expect((await res.json()).error.message).toMatch(/from rejected to hired/)
    await disposePool(pool)
  })

  test('answers 400 for an unknown or missing status', async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    expect((await setStatus(pool.employer.ctx, pool.ada.applicationId, 'nonsense')).status()).toBe(400)
    const missing = await pool.employer.ctx.patch(`/api/applications/${pool.ada.applicationId}/status`, { data: {} })
    expect(missing.status()).toBe(400)
    await disposePool(pool)
  })
})

test.describe('rating', () => {
  test('sets, changes and clears a rating without touching the match score', async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    const id = pool.ada.applicationId

    const set = await setRatingApi(pool.employer.ctx, id, 4)
    expect(set.status()).toBe(200)
    expect(await set.json()).toEqual({ id, rating: 4 })
    expect((await listHiring(pool.employer.ctx)).applicants.find((a) => a.id === id)).toMatchObject({ rating: 4, matchScore: 75 })

    await setRatingApi(pool.employer.ctx, id, 2)
    expect((await listHiring(pool.employer.ctx)).applicants.find((a) => a.id === id)?.rating).toBe(2)

    await setRatingApi(pool.employer.ctx, id, null)
    const cleared = await listHiring(pool.employer.ctx)
    expect(cleared.applicants.find((a) => a.id === id)).toMatchObject({ rating: null, matchScore: 75 })
    await disposePool(pool)
  })

  test('keeps ratings private from the candidate', async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    await setRatingApi(pool.employer.ctx, pool.ada.applicationId, 5)
    const mine = await (await pool.ada.ctx.get('/api/candidate/applications')).json()
    const [application] = mine.applications
    expect(Object.keys(application)).not.toContain('rating')
    expect(JSON.stringify(mine)).not.toContain('"rating"')
    await disposePool(pool)
  })

  test('rejects a rating that is not an integer from 1 to 5 with 400', async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    for (const rating of [0, 6, 2.5, '3', true]) {
      const res = await pool.employer.ctx.patch(`/api/employer/applications/${pool.ada.applicationId}/rating`, {
        data: { rating },
      })
      expect(res.status(), JSON.stringify(rating)).toBe(400)
    }
    const missing = await pool.employer.ctx.patch(`/api/employer/applications/${pool.ada.applicationId}/rating`, { data: {} })
    expect(missing.status()).toBe(400)
    expect((await listHiring(pool.employer.ctx)).applicants.find((a) => a.id === pool.ada.applicationId)?.rating).toBeNull()
    await disposePool(pool)
  })
})

test.describe('notes and activity', () => {
  test('adds a trimmed note that shows in the activity and the note count', async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    const res = await addNoteApi(pool.employer.ctx, pool.ada.applicationId, '   Strong on caching   ')
    expect(res.status()).toBe(201)
    const { note } = await res.json()
    expect(note).toMatchObject({ body: 'Strong on caching' })

    const { notes } = await activityApi(pool.employer.ctx, pool.ada.applicationId)
    expect(notes.map((n) => n.body)).toEqual(['Strong on caching'])
    expect((await listHiring(pool.employer.ctx)).applicants.find((a) => a.id === pool.ada.applicationId)?.noteCount).toBe(1)
    await disposePool(pool)
  })

  test('accepts 2000 characters and rejects 2001 or a blank note with 400', async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    const id = pool.ada.applicationId
    expect((await addNoteApi(pool.employer.ctx, id, 'x'.repeat(2000))).status()).toBe(201)
    expect((await addNoteApi(pool.employer.ctx, id, 'x'.repeat(2001))).status()).toBe(400)
    expect((await addNoteApi(pool.employer.ctx, id, '   ')).status()).toBe(400)
    expect((await activityApi(pool.employer.ctx, id)).notes).toHaveLength(1)
    await disposePool(pool)
  })

  test('deletes a note once, and never through another application', async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    const first = await (await addNoteApi(pool.employer.ctx, pool.ada.applicationId, 'To delete')).json()
    const noteId = first.note.id as string

    // The note belongs to Ada's application, so Grace's path cannot remove it.
    const wrong = await pool.employer.ctx.delete(`/api/employer/applications/${pool.grace.applicationId}/notes/${noteId}`)
    expect(wrong.status()).toBe(404)
    expect((await activityApi(pool.employer.ctx, pool.ada.applicationId)).notes.map((n) => n.id)).toContain(noteId)

    const removed = await pool.employer.ctx.delete(`/api/employer/applications/${pool.ada.applicationId}/notes/${noteId}`)
    expect(removed.status()).toBe(204)
    const again = await pool.employer.ctx.delete(`/api/employer/applications/${pool.ada.applicationId}/notes/${noteId}`)
    expect(again.status()).toBe(404)
    expect((await activityApi(pool.employer.ctx, pool.ada.applicationId)).notes).toEqual([])
    await disposePool(pool)
  })

  test('keeps notes private from the candidate', async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    await addNoteApi(pool.employer.ctx, pool.ada.applicationId, 'Internal only remark')
    const mine = await (await pool.ada.ctx.get('/api/candidate/applications')).json()
    expect(JSON.stringify(mine)).not.toContain('Internal only remark')
    expect(JSON.stringify(mine)).not.toContain('noteCount')
    await disposePool(pool)
  })

  test("hides another employer's application, notes and activity behind 404", async ({ playwright, baseURL }) => {
    const pool = await setupPool(playwright, baseURL)
    const note = await (await addNoteApi(pool.employer.ctx, pool.ada.applicationId, 'Private')).json()
    const other = await newEmployer(playwright, baseURL)
    const id = pool.ada.applicationId

    expect((await other.ctx.get(`/api/employer/applications/${id}/activity`)).status()).toBe(404)
    expect((await addNoteApi(other.ctx, id, 'Sneaky')).status()).toBe(404)
    expect((await other.ctx.delete(`/api/employer/applications/${id}/notes/${note.note.id}`)).status()).toBe(404)
    expect((await setRatingApi(other.ctx, id, 1)).status()).toBe(404)
    expect((await setStatus(other.ctx, id, 'under_review')).status()).toBe(404)

    // Unknown and malformed ids look the same.
    expect((await other.ctx.get(`/api/employer/applications/${MISSING_ID}/activity`)).status()).toBe(404)
    expect((await setRatingApi(pool.employer.ctx, 'not-a-uuid', 3)).status()).toBe(404)
    expect((await addNoteApi(pool.employer.ctx, MISSING_ID, 'x')).status()).toBe(404)

    expect((await activityApi(pool.employer.ctx, id)).notes.map((n) => n.body)).toEqual(['Private'])
    await dispose(other.ctx)
    await disposePool(pool)
  })
})
