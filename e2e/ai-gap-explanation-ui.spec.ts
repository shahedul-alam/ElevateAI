import { expect, test } from '@playwright/test'
import { registerUser } from './support/auth'
import { PROFILE_A, PROFILE_B, publishScoredJob } from './support/matching'
import { saveProfileApi } from './support/profile'

// The Explain button is not clicked here (success paths: ai-gap-explanation-success.spec.ts).
const section = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Gap explanation' })

test.describe('gap explanation section on the job page', () => {
  test('shows the button and the OpenAI notice for a candidate below 100', async ({ page, browser, baseURL }) => {
    const employerContext = await browser.newContext({ baseURL })
    await registerUser(employerContext.request, { role: 'employer' })
    const job = await publishScoredJob(employerContext.request)
    await registerUser(page.request)
    await saveProfileApi(page.request, PROFILE_A)

    await page.goto(`/jobs/${job.id}`)
    await expect(page.getByTestId('live-score')).toHaveText('67%')
    await expect(section(page)).toBeVisible()
    await expect(section(page).getByRole('button', { name: 'Explain this gap' })).toBeVisible()
    await expect(section(page)).toContainText('Your resume skills and this job’s requirements are sent to OpenAI')
    await employerContext.close()
  })

  test('is absent when the candidate scores 100', async ({ page, browser, baseURL }) => {
    const employerContext = await browser.newContext({ baseURL })
    await registerUser(employerContext.request, { role: 'employer' })
    const job = await publishScoredJob(employerContext.request)
    await registerUser(page.request)
    await saveProfileApi(page.request, PROFILE_B)

    await page.goto(`/jobs/${job.id}`)
    await expect(page.getByTestId('live-score')).toHaveText('100%')
    await expect(section(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Explain this gap' })).toHaveCount(0)
    await employerContext.close()
  })

  test('is absent for a candidate without a resume', async ({ page, browser, baseURL }) => {
    const employerContext = await browser.newContext({ baseURL })
    await registerUser(employerContext.request, { role: 'employer' })
    const job = await publishScoredJob(employerContext.request)
    await registerUser(page.request)

    await page.goto(`/jobs/${job.id}`)
    await expect(page.getByText('Build your resume to see how you match')).toBeVisible()
    await expect(section(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Explain this gap' })).toHaveCount(0)
    await employerContext.close()
  })

  test('is absent for anonymous visitors', async ({ page, browser, baseURL }) => {
    const employerContext = await browser.newContext({ baseURL })
    await registerUser(employerContext.request, { role: 'employer' })
    const job = await publishScoredJob(employerContext.request)

    await page.goto(`/jobs/${job.id}`)
    await expect(page.getByText(/as a candidate to see your match score and apply/)).toBeVisible()
    await expect(section(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Explain this gap' })).toHaveCount(0)
    await employerContext.close()
  })

  test('is absent for employers', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishScoredJob(page.request)

    await page.goto(`/jobs/${job.id}`)
    await expect(page.getByRole('heading', { name: job.content.title })).toBeVisible()
    await expect(section(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Explain this gap' })).toHaveCount(0)
  })
})
