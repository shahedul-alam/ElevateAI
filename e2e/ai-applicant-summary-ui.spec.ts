import { expect, test, type Page } from '@playwright/test'
import { applyCandidate } from './support/hiring'
import { newEmployer, publishReactJob, reactProfile } from './support/matching'

import { PASSWORD } from './support/auth'

// AI_ENABLED=false on the e2e stacks: no summary is ever generated, so only the empty state is shown.

const card = (page: Page, email: string) => page.getByRole('listitem').filter({ hasText: email })

async function expectEmptySummary(page: Page, email: string) {
  const c = card(page, email)
  await expect(c).toBeVisible()
  await expect(c.getByText('AI summary', { exact: true })).toBeVisible()
  await expect(c.getByText('Not ready yet. It appears here once it has been written.')).toBeVisible()
  await expect(c.getByText('Describes the resume only. It is not a recommendation.')).toBeVisible()
}

test.describe('applicant summary UI', () => {
  test('hiring page and per-job applicants page show the summary block with its empty state', async ({
    page,
    playwright,
    baseURL,
  }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const applicant = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))

    expect((await page.request.post('/api/auth/login', { data: { email: employer.user.email, password: PASSWORD } })).status()).toBe(200)

    await page.goto('/employer/hiring')
    await expectEmptySummary(page, applicant.user.email)

    await page.goto(`/employer/jobs/${job.id}/applicants`)
    await expectEmptySummary(page, applicant.user.email)

    await employer.ctx.dispose()
    await applicant.ctx.dispose()
  })

  test('the candidate applications page shows no summary text', async ({ page, playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const applicant = await applyCandidate(playwright, baseURL, 'Grace Hopper', job.id, reactProfile(4))

    expect((await page.request.post('/api/auth/login', { data: { email: applicant.user.email, password: PASSWORD } })).status()).toBe(200)
    await page.goto('/applications')
    await expect(page.getByText(job.content.title).first()).toBeVisible()
    await expect(page.getByText('AI summary')).toHaveCount(0)
    await expect(page.getByText('Describes the resume only')).toHaveCount(0)
    await expect(page.getByText('Not ready yet')).toHaveCount(0)

    await employer.ctx.dispose()
    await applicant.ctx.dispose()
  })
})
