import { expect, test } from '@playwright/test'
import { grantAiConsent, registerUser } from './support/auth'

// The stub answers the draft request; only that it was sent is asserted here (see ai-job-assistant-success.spec.ts).
const DRAFT = '/api/employer/jobs/ai-draft'

test.describe('AI privacy notice page', () => {
  test('renders the notice and is reachable from the footer', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('contentinfo').getByRole('link', { name: 'AI privacy notice' }).click()
    await expect(page).toHaveURL(/\/privacy$/)
    await expect(page.getByRole('heading', { name: 'AI privacy notice', level: 1 })).toBeVisible()
  })

  test('shows the footer link', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'AI privacy notice' })).toBeVisible()
  })
})

test.describe('account AI features card', () => {
  test('says a new user has not agreed yet and offers no withdraw button', async ({ page }) => {
    await registerUser(page.request)
    await page.goto('/account')
    await expect(page.getByText('AI features', { exact: true })).toBeVisible()
    await expect(page.getByText(/You have not agreed yet/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Withdraw consent' })).toHaveCount(0)
  })

  test('lets a consented user withdraw', async ({ page }) => {
    await registerUser(page.request)
    await grantAiConsent(page.request)
    await page.goto('/account')
    await expect(page.getByText(/You agreed to send the text/)).toBeVisible()

    await page.getByRole('button', { name: 'Withdraw consent' }).click()
    await expect(page.getByText('AI consent withdrawn')).toBeVisible()
    await expect(page.getByText(/You have not agreed yet/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Withdraw consent' })).toHaveCount(0)
  })
})

test.describe('consent dialog on the job post assistant', () => {
  const open = async (page: import('@playwright/test').Page) => {
    await registerUser(page.request, { role: 'employer' })
    await page.goto('/employer/jobs/new')
    await page.getByLabel('Pasted posting text').fill('x'.repeat(25))
    await page.getByRole('button', { name: 'Draft with AI' }).click()
    const dialog = page.getByRole('alertdialog', { name: 'Use AI features?' })
    await expect(dialog).toBeVisible()
    return dialog
  }

  test('Cancel closes it and sends no request', async ({ page }) => {
    const sent: string[] = []
    page.on('request', (r) => {
      if (r.url().includes(DRAFT)) sent.push(r.url())
    })
    const dialog = await open(page)
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    expect(sent).toEqual([])
    expect(((await (await page.request.get('/api/me')).json()).user.aiConsent)).toBe(false)
  })

  test('Agree records consent and sends the draft request', async ({ page }) => {
    const dialog = await open(page)
    const draftRequest = page.waitForRequest((r) => r.url().includes(DRAFT) && r.method() === 'POST')
    await dialog.getByRole('button', { name: 'Agree and continue' }).click()
    await draftRequest
    await expect(dialog).toBeHidden()
    expect((await (await page.request.get('/api/me')).json()).user.aiConsent).toBe(true)
  })
})
