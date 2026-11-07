import { expect, test, type APIRequestContext } from '@playwright/test'
import { grantAiConsent, PASSWORD } from './support/auth'
import { newNamedCandidate } from './support/hiring'
import { listApplicants, newEmployer, publishReactJob, reactProfile } from './support/matching'

// AI_STUB is on: a consented candidate's summary is the canned text, written in the background after apply.
const SUMMARY_START = 'The candidate is an engineer with several years of web development experience.'

const summaryOf = async (employer: APIRequestContext, jobId: string) =>
  ((await listApplicants(employer, jobId)).applicants[0] as unknown as { summary: string | null }).summary

test.describe('applicant summary API with the stubbed model', () => {
  test('a consented candidate gets a summary the employer sees and the candidate never does', async ({
    playwright,
    baseURL,
  }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const candidate = await newNamedCandidate(playwright, baseURL, 'Ada Lovelace', reactProfile(3))
    await grantAiConsent(candidate.ctx)

    const apply = await candidate.ctx.post(`/api/jobs/${job.id}/apply`)
    expect(apply.status(), await apply.text()).toBe(201)
    expect(await apply.text()).not.toContain('"summary"')

    await expect.poll(() => summaryOf(employer.ctx, job.id), { timeout: 15_000 }).toContain(SUMMARY_START)

    const mine = await candidate.ctx.get('/api/candidate/applications')
    expect(mine.status()).toBe(200)
    expect(await mine.text()).not.toContain('"summary"')

    await employer.ctx.dispose()
    await candidate.ctx.dispose()
  })

  test('an unconsented candidate has no summary until they consent, then the next employer fetch fills it', async ({
    playwright,
    baseURL,
  }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const candidate = await newNamedCandidate(playwright, baseURL, 'Grace Hopper', reactProfile(3))
    const apply = await candidate.ctx.post(`/api/jobs/${job.id}/apply`)
    expect(apply.status(), await apply.text()).toBe(201)

    // No locator to wait on: give the background job time to (wrongly) write something.
    await new Promise((resolve) => setTimeout(resolve, 3000))
    expect(await summaryOf(employer.ctx, job.id)).toBeNull()

    await grantAiConsent(candidate.ctx)
    await expect.poll(() => summaryOf(employer.ctx, job.id), { timeout: 15_000 }).toContain(SUMMARY_START)

    await employer.ctx.dispose()
    await candidate.ctx.dispose()
  })
})

test.describe('applicant summary on applicant cards with the stubbed model', () => {
  test('the employer sees the summary on the hiring page and the per-job page', async ({ page, playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const candidate = await newNamedCandidate(playwright, baseURL, 'Alan Turing', reactProfile(3))
    await grantAiConsent(candidate.ctx)
    expect((await candidate.ctx.post(`/api/jobs/${job.id}/apply`)).status()).toBe(201)

    expect(
      (await page.request.post('/api/auth/login', { data: { email: employer.user.email, password: PASSWORD } })).status(),
    ).toBe(200)

    for (const path of ['/employer/hiring', `/employer/jobs/${job.id}/applicants`]) {
      await page.goto(path)
      const card = page.getByRole('listitem').filter({ hasText: candidate.user.email })
      // The list polls every 5 s while the summary is missing.
      await expect(card.getByText(SUMMARY_START)).toBeVisible({ timeout: 20_000 })
      await expect(card.getByText('Not ready yet.')).toHaveCount(0)
    }

    await employer.ctx.dispose()
    await candidate.ctx.dispose()
  })
})
