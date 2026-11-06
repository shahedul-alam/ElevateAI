import { expect, test, type Page } from '@playwright/test'
import { registerUser } from './support/auth'
import { applyCandidate, setRatingApi } from './support/hiring'
import { uniqueTitle } from './support/jobs'
import { publishReactJob, reactProfile, setStatus } from './support/matching'

/** The applicant card for one candidate (cards show the candidate's email). */
const card = (page: Page, email: string) => page.getByRole('listitem').filter({ hasText: email })

test.describe('hiring page access', () => {
  test('sends anonymous visitors to /login', async ({ page }) => {
    await page.goto('/employer/hiring')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('tells candidates the page is for employers and hides the Hiring link', async ({ page }) => {
    await registerUser(page.request, { role: 'candidate' })
    await page.goto('/employer/hiring')
    await expect(page.getByText('Hiring is for employer accounts.')).toBeVisible()
    await expect(page.getByRole('banner').getByRole('link', { name: 'Hiring', exact: true })).toHaveCount(0)
  })

  test('links to Hiring from the navbar for employers', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    await page.goto('/')
    await expect(page.getByRole('banner').getByRole('link', { name: 'Hiring', exact: true })).toHaveAttribute(
      'href',
      '/employer/hiring',
    )
  })
})

test.describe('hiring list', () => {
  test('lists applicants across jobs, with a count per stage and working filters', async ({ page, playwright, baseURL }) => {
    await registerUser(page.request, { role: 'employer' })
    const frontend = await publishReactJob(page.request, 4, { title: uniqueTitle('Frontend') })
    const backend = await publishReactJob(page.request, 2, { title: uniqueTitle('Backend') })
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', frontend.id, reactProfile(3))
    const grace = await applyCandidate(playwright, baseURL, 'Grace Hopper', frontend.id, reactProfile(4))
    const alan = await applyCandidate(playwright, baseURL, 'Alan Turing', backend.id, reactProfile(2))
    await setStatus(page.request, ada.applicationId, 'offer')

    await page.goto('/employer/hiring')
    await expect(card(page, ada.user.email)).toBeVisible()
    await expect(card(page, grace.user.email)).toBeVisible()
    await expect(card(page, alan.user.email)).toBeVisible()
    await expect(page.getByRole('button', { name: 'All (3)', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Applied (2)', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Offer (1)', exact: true }).click()
    await expect(page).toHaveURL(/status=offer/)
    await expect(page.getByRole('button', { name: 'Offer (1)', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(card(page, ada.user.email)).toBeVisible()
    await expect(card(page, grace.user.email)).toHaveCount(0)
    await expect(card(page, alan.user.email)).toHaveCount(0)
    // The counts still cover every stage while one is selected.
    await expect(page.getByRole('button', { name: 'Applied (2)', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'All (3)', exact: true }).click()
    await expect(card(page, grace.user.email)).toBeVisible()

    await page.getByLabel('Filter by job').selectOption({ label: backend.content.title })
    await expect(card(page, alan.user.email)).toBeVisible()
    await expect(card(page, grace.user.email)).toHaveCount(0)
    await page.getByLabel('Filter by job').selectOption({ label: 'All jobs' })

    await page.getByLabel('Search applicants by name').fill('hopper')
    await expect(card(page, grace.user.email)).toBeVisible()
    await expect(card(page, ada.user.email)).toHaveCount(0)
    await expect(page).toHaveURL(/q=hopper/)

    await ada.ctx.dispose()
    await grace.ctx.dispose()
    await alan.ctx.dispose()
  })

  test('filters by minimum rating', async ({ page, playwright, baseURL }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishReactJob(page.request, 4)
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))
    const grace = await applyCandidate(playwright, baseURL, 'Grace Hopper', job.id, reactProfile(4))
    await setRatingApi(page.request, grace.applicationId, 5)
    await setRatingApi(page.request, ada.applicationId, 2)

    await page.goto('/employer/hiring')
    await page.getByLabel('Minimum rating').selectOption({ label: '4+ stars' })
    await expect(card(page, grace.user.email)).toBeVisible()
    await expect(card(page, ada.user.email)).toHaveCount(0)

    await ada.ctx.dispose()
    await grace.ctx.dispose()
  })

  test('shows an empty state when there are no applicants, and a clearable one when filters hide them all', async ({
    page,
    playwright,
    baseURL,
  }) => {
    await registerUser(page.request, { role: 'employer' })
    await page.goto('/employer/hiring')
    await expect(page.getByText('No applications yet.')).toBeVisible()

    const job = await publishReactJob(page.request, 4)
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))
    await page.reload()
    await page.getByRole('button', { name: 'Rejected (0)', exact: true }).click()
    await expect(page.getByText('No applicants match your filters.')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(card(page, ada.user.email)).toBeVisible()

    await ada.ctx.dispose()
  })
})

test.describe('moving applicants through stages', () => {
  test('moves to an intermediate stage straight from the select, with no confirmation', async ({
    page,
    playwright,
    baseURL,
  }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishReactJob(page.request, 4)
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))

    await page.goto('/employer/hiring')
    const row = card(page, ada.user.email)
    await row.getByLabel('Move to stage').selectOption({ label: 'Under review' })
    await expect(row.getByText('Under review', { exact: true })).toBeVisible()
    await expect(row.getByRole('option', { name: 'Under review (current)' })).toBeAttached()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Under review (1)', exact: true })).toBeVisible()

    await ada.ctx.dispose()
  })

  test('asks before hiring, and cancelling keeps the stage', async ({ page, playwright, baseURL }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishReactJob(page.request, 4)
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))
    await setStatus(page.request, ada.applicationId, 'offer')

    await page.goto('/employer/hiring')
    const row = card(page, ada.user.email)
    const stage = row.getByLabel('Move to stage')
    await stage.selectOption({ label: 'Hired' })
    const dialog = page.getByRole('alertdialog', { name: 'Hire Ada Lovelace?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    await expect(stage).toHaveValue('offer')

    await stage.selectOption({ label: 'Hired' })
    await page.getByRole('alertdialog', { name: 'Hire Ada Lovelace?' }).getByRole('button', { name: 'Hire', exact: true }).click()
    await expect(row.getByText('Hired', { exact: true })).toBeVisible()
    // Hired is final, so there is no stage left to choose.
    await expect(row.getByLabel('Move to stage')).toHaveCount(0)

    await ada.ctx.dispose()
  })

  test('rejects from an interview stage after confirming', async ({ page, playwright, baseURL }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishReactJob(page.request, 4)
    const grace = await applyCandidate(playwright, baseURL, 'Grace Hopper', job.id, reactProfile(4))
    await setStatus(page.request, grace.applicationId, 'under_review')
    await setStatus(page.request, grace.applicationId, 'technical_interview')

    await page.goto('/employer/hiring')
    const row = card(page, grace.user.email)
    await row.getByLabel('Move to stage').selectOption({ label: 'Rejected' })
    await page.getByRole('alertdialog', { name: 'Reject Grace Hopper?' }).getByRole('button', { name: 'Reject', exact: true }).click()
    await expect(row.getByText('Rejected', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rejected (1)', exact: true })).toBeVisible()
    await expect(row.getByLabel('Move to stage')).toHaveCount(0)

    await grace.ctx.dispose()
  })

  test('shows an error toast and keeps the stored stage when the applicant has moved on', async ({
    page,
    playwright,
    baseURL,
  }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishReactJob(page.request, 4)
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))

    await page.goto('/employer/hiring')
    const row = card(page, ada.user.email)
    await expect(row.getByLabel('Move to stage')).toBeVisible()
    // Another session rejects the application while this page still shows it as applied.
    await setStatus(page.request, ada.applicationId, 'rejected')

    await row.getByLabel('Move to stage').selectOption({ label: 'Under review' })
    await expect(page.getByText('Could not update')).toBeVisible()
    await expect(page.getByText(/Cannot move an application from rejected to under_review/)).toBeVisible()

    await page.reload()
    await expect(card(page, ada.user.email).getByText('Rejected', { exact: true })).toBeVisible()

    await ada.ctx.dispose()
  })

  test('shows the stage history in the details sheet', async ({ page, playwright, baseURL }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishReactJob(page.request, 4)
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))
    await setStatus(page.request, ada.applicationId, 'under_review')
    await setStatus(page.request, ada.applicationId, 'technical_interview')

    await page.goto('/employer/hiring')
    await card(page, ada.user.email).getByRole('button', { name: /Notes \(0\) and history/ }).click()
    const sheet = page.getByRole('dialog', { name: 'Ada Lovelace' })
    await expect(sheet.getByText('Applied → Under review', { exact: true })).toBeVisible()
    await expect(sheet.getByText('Under review → Technical interview', { exact: true })).toBeVisible()

    await ada.ctx.dispose()
  })
})

test.describe('rating, notes and the per-job page', () => {
  test('rates an applicant with stars; clicking the same star again clears the rating', async ({
    page,
    playwright,
    baseURL,
  }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishReactJob(page.request, 4)
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))

    await page.goto('/employer/hiring')
    const stars = (p: Page) => card(p, ada.user.email).getByRole('group', { name: 'Your rating for Ada Lovelace' })
    await stars(page).getByRole('button', { name: '4 stars' }).click()
    await expect(stars(page).getByRole('button', { name: '4 stars' })).toHaveAttribute('aria-pressed', 'true')

    await page.reload()
    await expect(stars(page).getByRole('button', { name: '4 stars' })).toHaveAttribute('aria-pressed', 'true')

    await stars(page).getByRole('button', { name: '4 stars' }).click()
    await expect(stars(page).getByRole('button', { name: '4 stars' })).toHaveAttribute('aria-pressed', 'false')
    await page.reload()
    await expect(stars(page).getByRole('button', { name: '4 stars' })).toHaveAttribute('aria-pressed', 'false')

    await ada.ctx.dispose()
  })

  test('adds a note, then deletes it only after confirming', async ({ page, playwright, baseURL }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishReactJob(page.request, 4)
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))

    await page.goto('/employer/hiring')
    const row = card(page, ada.user.email)
    await row.getByRole('button', { name: 'Notes (0) and history' }).click()
    const sheet = page.getByRole('dialog', { name: 'Ada Lovelace' })
    await sheet.getByLabel('New note').fill('Strong on caching')
    await sheet.getByRole('button', { name: 'Add note' }).click()
    await expect(sheet.getByText('Strong on caching')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(row.getByRole('button', { name: 'Notes (1) and history' })).toBeVisible()

    await row.getByRole('button', { name: 'Notes (1) and history' }).click()
    await page.getByRole('dialog', { name: 'Ada Lovelace' }).getByRole('button', { name: 'Delete', exact: true }).click()
    const confirm = page.getByRole('alertdialog', { name: 'Delete this note?' })
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: 'Cancel' }).click()
    await expect(confirm).toBeHidden()
    await expect(page.getByRole('dialog', { name: 'Ada Lovelace' }).getByText('Strong on caching')).toBeVisible()

    await page.getByRole('dialog', { name: 'Ada Lovelace' }).getByRole('button', { name: 'Delete', exact: true }).click()
    await page.getByRole('alertdialog', { name: 'Delete this note?' }).getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Ada Lovelace' }).getByText('No notes yet.')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(row.getByRole('button', { name: 'Notes (0) and history' })).toBeVisible()

    await ada.ctx.dispose()
  })

  test('the per-job applicants page uses the same card and opens Hiring filtered to that job', async ({
    page,
    playwright,
    baseURL,
  }) => {
    await registerUser(page.request, { role: 'employer' })
    const frontend = await publishReactJob(page.request, 4, { title: uniqueTitle('Frontend') })
    const backend = await publishReactJob(page.request, 4, { title: uniqueTitle('Backend') })
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', frontend.id, reactProfile(3))
    const grace = await applyCandidate(playwright, baseURL, 'Grace Hopper', backend.id, reactProfile(4))

    await page.goto(`/employer/jobs/${frontend.id}/applicants`)
    const row = card(page, ada.user.email)
    await expect(row.getByLabel('Move to stage')).toBeVisible()
    await expect(card(page, grace.user.email)).toHaveCount(0)

    await page.getByRole('link', { name: 'Open in Hiring' }).click()
    await expect(page).toHaveURL(new RegExp(`/employer/hiring\\?job=${frontend.id}$`))
    await expect(page.getByLabel('Filter by job')).toHaveValue(frontend.id)
    await expect(card(page, ada.user.email)).toBeVisible()
    await expect(card(page, grace.user.email)).toHaveCount(0)

    await ada.ctx.dispose()
    await grace.ctx.dispose()
  })
})
