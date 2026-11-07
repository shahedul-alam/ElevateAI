import { expect, test } from '@playwright/test'
import { grantAiConsent, registerUser } from './support/auth'
import { newCandidate, newEmployer, PROFILE_A, publishScoredJob } from './support/matching'
import { saveProfileApi } from './support/profile'

// AI_STUB is on: every explanation is the canned one. PROFILE_A scores 67 against the scored job.
const SUMMARY = 'You fit the core of this role; a couple of skills would close the gap.'
const url = (id: string) => `/api/jobs/${id}/gap/explanation`

test.describe('gap explanation API with the stubbed model', () => {
  test('POST returns the canned explanation, GET returns it later, only the first POST uses quota', async ({
    playwright,
    baseURL,
  }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishScoredJob(employer.ctx)
    const { ctx } = await newCandidate(playwright, baseURL, PROFILE_A)
    await grantAiConsent(ctx)

    const first = await ctx.post(url(job.id))
    expect(first.status(), await first.text()).toBe(200)
    const firstBody = await first.json()
    expect(firstBody.explanation.summary).toBe(SUMMARY)
    expect(firstBody.explanation.steps.map((s: { focus: string }) => s.focus)).toEqual(['Docker', 'AWS'])
    expect(firstBody.remainingToday).toBe(19)

    const repeat = await ctx.post(url(job.id))
    expect(repeat.status()).toBe(200)
    expect(await repeat.json()).toEqual(firstBody)

    expect(await (await ctx.get(url(job.id))).json()).toEqual(firstBody)

    await ctx.dispose()
    await employer.ctx.dispose()
  })

  test('a changed resume has no explanation until it is explained again', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishScoredJob(employer.ctx)
    const { ctx } = await newCandidate(playwright, baseURL, PROFILE_A)
    await grantAiConsent(ctx)
    expect((await ctx.post(url(job.id))).status()).toBe(200)

    // Still below 100, but a new profile version.
    await saveProfileApi(ctx, { ...PROFILE_A, headline: 'Profile A changed' })
    const after = await ctx.get(url(job.id))
    expect(after.status()).toBe(200)
    expect((await after.json()).explanation).toBeNull()

    await ctx.dispose()
    await employer.ctx.dispose()
  })
})

test.describe('gap explanation section with the stubbed model', () => {
  test('asks for consent, then shows the summary and steps', async ({ page, browser, baseURL }) => {
    const employerContext = await browser.newContext({ baseURL })
    await registerUser(employerContext.request, { role: 'employer' })
    const job = await publishScoredJob(employerContext.request)
    await registerUser(page.request)
    await saveProfileApi(page.request, PROFILE_A)

    await page.goto(`/jobs/${job.id}`)
    const section = page.getByRole('region', { name: 'Gap explanation' })
    await section.getByRole('button', { name: 'Explain this gap' }).click()

    const consent = page.getByRole('alertdialog')
    await expect(consent.getByText('Use AI features?')).toBeVisible()
    await consent.getByRole('button', { name: 'Agree and continue' }).click()

    await expect(section.getByText(SUMMARY)).toBeVisible()
    await expect(section.getByText('Docker.')).toBeVisible()
    await expect(section.getByText('AWS.')).toBeVisible()
    await expect(section.getByRole('button', { name: 'Explain this gap' })).toHaveCount(0)

    // Stored: a reload shows it without clicking.
    await page.reload()
    await expect(section.getByText(SUMMARY)).toBeVisible()
    await employerContext.close()
  })
})
