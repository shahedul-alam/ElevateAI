import { expect, test } from '@playwright/test'
import { registerUser } from './support/auth'
import { createJobApi, jobAction, publishJobApi } from './support/jobs'

// The Draft with AI button is not clicked here (success paths: ai-job-assistant-success.spec.ts).
test.describe('Draft with AI card', () => {
  test('is shown on the new job page and explains what happens to the text', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    await page.goto('/employer/jobs/new')

    await expect(page.getByText('Draft with AI', { exact: true }).first()).toBeVisible()
    await expect(page.getByLabel('Pasted posting text')).toBeVisible()
    await expect(page.getByText(/sent to OpenAI/)).toBeVisible()
    await expect(page.getByText(/nothing is saved until you press Save/)).toBeVisible()
  })

  test('enables the button only once 20 trimmed characters are typed', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    await page.goto('/employer/jobs/new')

    const text = page.getByLabel('Pasted posting text')
    const button = page.getByRole('button', { name: 'Draft with AI' })
    await expect(button).toBeDisabled()
    await expect(page.getByText('At least 20 characters.')).toBeVisible()

    await text.fill('Short text')
    await expect(button).toBeDisabled()

    // Padding does not count towards the minimum.
    await text.fill(`     ${'x'.repeat(19)}     `)
    await expect(button).toBeDisabled()
    await expect(page.getByText('At least 20 characters.')).toBeVisible()

    await text.fill('x'.repeat(20))
    await expect(button).toBeEnabled()
    await expect(page.getByText('At least 20 characters.')).toHaveCount(0)

    await text.fill('')
    await expect(button).toBeDisabled()
  })

  test('is shown when editing a draft or active job', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const draft = await createJobApi(page.request)
    const active = await publishJobApi(page.request)

    for (const job of [draft, active]) {
      await page.goto(`/employer/jobs/${job.id}/edit`)
      await expect(page.getByLabel('Pasted posting text')).toBeVisible()
    }
  })

  test('is not shown for a closed job', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishJobApi(page.request)
    await jobAction(page.request, job.id, 'close')

    await page.goto(`/employer/jobs/${job.id}/edit`)
    await expect(page.getByText('This job is closed and can no longer be edited.')).toBeVisible()
    await expect(page.getByLabel('Pasted posting text')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Draft with AI' })).toHaveCount(0)
  })
})
