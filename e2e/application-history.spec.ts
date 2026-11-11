import { expect, test, type APIRequestContext, type Playwright } from '@playwright/test'
import { addNoteApi, setRatingApi } from './support/hiring'
import { newCandidate, newEmployer, publishReactJob, reactProfile, setStatus, applyApi } from './support/matching'

type Entry = { fromStatus: string | null; toStatus: string; createdAt: string }

async function historyOf(request: APIRequestContext) {
  const res = await request.get('/api/candidate/applications')
  expect(res.status(), await res.text()).toBe(200)
  const body = await res.json()
  return { raw: JSON.stringify(body), applications: body.applications as { id: string; history: Entry[] }[] }
}

/** An employer with an active job and a candidate who applied to it. */
async function setup(playwright: Playwright, baseURL: string | undefined) {
  const employer = await newEmployer(playwright, baseURL)
  const job = await publishReactJob(employer.ctx, 4)
  const candidate = await newCandidate(playwright, baseURL, reactProfile(3))
  const application = await applyApi(candidate.ctx, job.id)
  const cleanup = async () => {
    await employer.ctx.dispose()
    await candidate.ctx.dispose()
  }
  return { employer, candidate, job, application, cleanup }
}

test.describe('candidate application status history API', () => {
  test('a new application has one entry: null to applied', async ({ playwright, baseURL }) => {
    const s = await setup(playwright, baseURL)
    const { applications } = await historyOf(s.candidate.ctx)
    expect(applications).toHaveLength(1)
    expect(applications[0].history).toHaveLength(1)
    expect(applications[0].history[0]).toMatchObject({ fromStatus: null, toStatus: 'applied' })
    await s.cleanup()
  })

  test('lists every stage move in order, ending with a rejection', async ({ playwright, baseURL }) => {
    const s = await setup(playwright, baseURL)
    expect((await setStatus(s.employer.ctx, s.application.id, 'under_review')).status()).toBe(200)
    expect((await setStatus(s.employer.ctx, s.application.id, 'technical_interview')).status()).toBe(200)

    let { applications } = await historyOf(s.candidate.ctx)
    expect(applications[0].history.map((h) => [h.fromStatus, h.toStatus])).toEqual([
      [null, 'applied'],
      ['applied', 'under_review'],
      ['under_review', 'technical_interview'],
    ])

    expect((await setStatus(s.employer.ctx, s.application.id, 'rejected')).status()).toBe(200)
    ;({ applications } = await historyOf(s.candidate.ctx))
    expect(applications[0].history.map((h) => [h.fromStatus, h.toStatus]).at(-1)).toEqual(['technical_interview', 'rejected'])
    expect(applications[0].history).toHaveLength(4)
    await s.cleanup()
  })

  test('does not leak employer notes, ratings or actor ids', async ({ playwright, baseURL }) => {
    const s = await setup(playwright, baseURL)
    await setStatus(s.employer.ctx, s.application.id, 'under_review')
    const note = `private-note-${Date.now()}`
    expect((await addNoteApi(s.employer.ctx, s.application.id, note)).ok()).toBe(true)
    expect((await setRatingApi(s.employer.ctx, s.application.id, 4)).ok()).toBe(true)

    const { raw, applications } = await historyOf(s.candidate.ctx)
    expect(raw).not.toContain(note)
    for (const word of ['"rating"', '"notes"', 'actor', 'changedBy', 'employerId']) expect(raw).not.toContain(word)
    expect(applications[0].history.length).toBeGreaterThan(1)
    for (const h of applications[0].history) expect(Object.keys(h).sort()).toEqual(['createdAt', 'fromStatus', 'toStatus'])
    await s.cleanup()
  })

  test("never shows another candidate's application or its history", async ({ playwright, baseURL }) => {
    const s = await setup(playwright, baseURL)
    await setStatus(s.employer.ctx, s.application.id, 'under_review')
    const other = await newCandidate(playwright, baseURL, reactProfile(3))

    const { raw, applications } = await historyOf(other.ctx)
    expect(applications).toHaveLength(0)
    expect(raw).not.toContain(s.application.id)

    const mine = await historyOf(s.candidate.ctx)
    expect(mine.applications.map((a) => a.id)).toEqual([s.application.id])
    await other.ctx.dispose()
    await s.cleanup()
  })
})

test.describe('candidate applications page status history', () => {
  test('expands by click and by keyboard and shows the stage moves in order', async ({ page, playwright, baseURL }) => {
    const s = await setup(playwright, baseURL)
    // Sign the browser in as that candidate: reuse its cookies.
    await page.context().addCookies((await s.candidate.ctx.storageState()).cookies)
    await page.goto('/applications')

    const group = page.locator('details').filter({ hasText: 'Status history' })
    const summary = group.locator('summary')
    await expect(summary).toBeVisible()
    await expect(group.getByText('Applied', { exact: true })).toBeHidden()

    await summary.click()
    await expect(group.getByText('Applied', { exact: true })).toBeVisible()

    // Keyboard: Enter on the focused summary toggles it closed, then open again.
    await summary.focus()
    await page.keyboard.press('Enter')
    await expect(group.getByText('Applied', { exact: true })).toBeHidden()
    await page.keyboard.press('Enter')
    await expect(group.getByText('Applied', { exact: true })).toBeVisible()

    await setStatus(s.employer.ctx, s.application.id, 'under_review')
    await setStatus(s.employer.ctx, s.application.id, 'technical_interview')
    await page.reload()
    await page.locator('details').filter({ hasText: 'Status history' }).locator('summary').click()
    const items = page.locator('details').filter({ hasText: 'Status history' }).getByRole('listitem')
    await expect(items).toHaveCount(3)
    await expect(items.nth(0)).toContainText('Applied')
    await expect(items.nth(1)).toContainText('Applied → Under review')
    await expect(items.nth(2)).toContainText('Under review → Technical interview')

    await s.cleanup()
  })
})

// The employer sheet showing "Applied → Under review" is already covered by
// hiring-ui.spec.ts ("shows the stage history in the details sheet").
