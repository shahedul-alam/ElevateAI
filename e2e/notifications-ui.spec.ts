import { expect, test, type Page } from '@playwright/test'
import { registerUser } from './support/auth'
import { applyCandidate } from './support/hiring'
import { uniqueTitle } from './support/jobs'
import { applyApi, newEmployer, publishReactJob, reactProfile, setStatus } from './support/matching'
import { saveProfileApi } from './support/profile'

const bell = (page: Page, unread: number) =>
  page.getByRole('banner').getByRole('button', { name: `Notifications, ${unread} unread` })

/** Fires the same event the browser does when the tab becomes visible again, which makes the bell re-check. */
const refocus = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))

test.describe('notification bell', () => {
  test('is hidden for anonymous visitors', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /^Notifications/ })).toHaveCount(0)
  })

  test('shows an empty inbox with no badge for a new user', async ({ page }) => {
    await registerUser(page.request, { role: 'candidate' })
    await page.goto('/')
    await expect(bell(page, 0)).toBeVisible()
    await bell(page, 0).click()
    await expect(page.getByText('No notifications yet.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark all as read' })).toHaveCount(0)
  })

  test('candidate sees a stage change, opens it, and the badge clears', async ({ page, playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const title = uniqueTitle('Bell')
    const job = await publishReactJob(employer.ctx, 4, { title })
    await registerUser(page.request, { role: 'candidate' })
    await saveProfileApi(page.request, reactProfile(3))
    const { id } = await applyApi(page.request, job.id)
    await setStatus(employer.ctx, id, 'technical_interview')

    await page.goto('/jobs')
    await expect(bell(page, 1)).toBeVisible()
    await bell(page, 1).click()
    const item = page.getByRole('menuitem').filter({ hasText: `Technical interview: ${title}` })
    await expect(item).toContainText('moved to technical interview')
    await expect(item).toContainText('(unread)')

    await item.click()
    await expect(page).toHaveURL(/\/applications$/)
    await expect(bell(page, 0)).toBeVisible()
    await bell(page, 0).click()
    await expect(page.getByRole('menuitem').filter({ hasText: title })).not.toContainText('(unread)')
    await employer.ctx.dispose()
  })

  test('employer is told about a new application and the link opens that job in Hiring', async ({
    page,
    playwright,
    baseURL,
  }) => {
    await registerUser(page.request, { role: 'employer' })
    const title = uniqueTitle('Inbound')
    const job = await publishReactJob(page.request, 4, { title })
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))

    await page.goto('/employer/jobs')
    await expect(bell(page, 1)).toBeVisible()
    await bell(page, 1).click()
    const item = page.getByRole('menuitem').filter({ hasText: `New application: ${title}` })
    await expect(item).toContainText(`Ada Lovelace applied to ${title} (75% match).`)

    await item.click()
    await expect(page).toHaveURL(new RegExp(`/employer/hiring\\?job=${job.id}`))
    await expect(page.getByRole('heading', { name: 'Hiring' })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: ada.user.email })).toBeVisible()
    await expect(bell(page, 0)).toBeVisible()
    await ada.ctx.dispose()
  })

  test('"Mark all as read" clears the badge and the unread markers', async ({ page, playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const title = uniqueTitle('MarkAll')
    const job = await publishReactJob(employer.ctx, 4, { title })
    await registerUser(page.request, { role: 'candidate' })
    await saveProfileApi(page.request, reactProfile(3))
    const { id } = await applyApi(page.request, job.id)
    await setStatus(employer.ctx, id, 'under_review')
    await setStatus(employer.ctx, id, 'offer')

    await page.goto('/jobs')
    await expect(bell(page, 2)).toBeVisible()
    await bell(page, 2).click()
    await expect(page.getByRole('menuitem').filter({ hasText: '(unread)' })).toHaveCount(2)
    await page.getByRole('button', { name: 'Mark all as read' }).click()
    await expect(page.getByRole('menuitem').filter({ hasText: '(unread)' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Mark all as read' })).toHaveCount(0)
    // The bell is hidden from the accessibility tree while its menu is open.
    await page.keyboard.press('Escape')
    await expect(bell(page, 0)).toBeVisible()
    await employer.ctx.dispose()
  })

  test('picks up a new notification when the tab regains focus', async ({ page, playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    await registerUser(page.request, { role: 'candidate' })
    await saveProfileApi(page.request, reactProfile(3))
    const { id } = await applyApi(page.request, job.id)

    await page.goto('/jobs')
    await expect(bell(page, 0)).toBeVisible()
    await setStatus(employer.ctx, id, 'under_review')
    await refocus(page)
    await expect(bell(page, 1)).toBeVisible()
    await employer.ctx.dispose()
  })

  test("a signed-out then signed-in other user never sees the previous user's notifications", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const first = await registerUser(page.request, { role: 'candidate' })
    await saveProfileApi(page.request, reactProfile(3))
    const { id } = await applyApi(page.request, job.id)
    await setStatus(employer.ctx, id, 'offer')

    await page.goto('/jobs')
    await expect(bell(page, 1)).toBeVisible()
    await page.getByRole('banner').getByRole('button', { name: first.name }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page.getByRole('link', { name: 'Log in' }).first()).toBeVisible()

    await registerUser(page.request, { role: 'candidate' })
    await page.goto('/jobs')
    await expect(bell(page, 0)).toBeVisible()
    await bell(page, 0).click()
    await expect(page.getByText('No notifications yet.')).toBeVisible()
    await employer.ctx.dispose()
  })
})
