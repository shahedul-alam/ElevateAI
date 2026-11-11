import { expect, test } from '@playwright/test'
import { grantAiConsent, registerUser } from './support/auth'

// Only the no-saved-resume and unsaved-edits paths (success: ai-evaluator-success.spec.ts).
test.describe('resume review card', () => {
  test('is shown and says employers never see it', async ({ page }) => {
    await registerUser(page.request)
    await page.goto('/resume')
    await expect(page.getByText('Resume review')).toBeVisible()
    await expect(page.getByText(/employers never see it/)).toBeVisible()
  })

  test('asks to save the resume first when there is none', async ({ page }) => {
    await registerUser(page.request)
    await grantAiConsent(page.request)
    await page.goto('/resume')
    await page.getByRole('button', { name: 'Review my resume' }).click()
    await expect(page.getByText('Could not evaluate')).toBeVisible()
    await expect(page.getByText(/Save your resume first/)).toBeVisible()
  })

  test('disables the button while there are unsaved edits', async ({ page }) => {
    await registerUser(page.request)
    await page.goto('/resume')
    const button = page.getByRole('button', { name: 'Review my resume' })
    await expect(button).toBeEnabled()

    await page.getByLabel('Short professional headline').fill('Unsaved headline')
    await expect(button).toBeDisabled()
    await expect(page.getByText('Save your changes first: the review covers your last saved resume.')).toBeVisible()
  })
})
