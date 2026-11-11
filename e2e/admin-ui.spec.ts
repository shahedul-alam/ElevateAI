import { expect, test as base, type Page } from '@playwright/test'
import { registerUser } from './support/auth'
import { test } from './support/company'
import {
  REASON,
  meId,
  publishRareJob,
  signInAdminApi,
  suspendJobApi,
} from './support/admin'

const row = (page: Page, text: string) => page.getByRole('listitem').filter({ hasText: text })

/** Fills the reason and confirms inside the open Suspend dialog. */
async function confirmSuspend(page: Page, title: string, reason = REASON) {
  const dialog = page.getByRole('alertdialog', { name: title })
  await expect(dialog).toBeVisible()
  const submit = dialog.getByRole('button', { name: 'Suspend', exact: true })
  await expect(submit).toBeDisabled()
  await dialog.getByLabel(/Reason/).fill('ab')
  await expect(submit).toBeDisabled()
  await dialog.getByLabel(/Reason/).fill(reason)
  await expect(submit).toBeEnabled()
  await submit.click()
}

async function confirmRestore(page: Page, title: string) {
  const dialog = page.getByRole('alertdialog', { name: title })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Restore', exact: true }).click()
}

base.describe('admin page access', () => {
  base('sends anonymous visitors to /login', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login$/)
  })

  for (const role of ['candidate', 'employer'] as const) {
    base(`tells a ${role} the dashboard is for administrators`, async ({ page }) => {
      await registerUser(page.request, { role })
      await page.goto('/admin')
      await expect(page.getByText('The admin dashboard is for administrators.')).toBeVisible()
      await expect(page.getByRole('banner').getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0)
    })
  }

  base('shows admins the Admin link and no candidate links', async ({ page }) => {
    await signInAdminApi(page)
    await page.goto('/')
    const banner = page.getByRole('banner')
    await expect(banner.getByRole('link', { name: 'Admin', exact: true })).toHaveAttribute('href', '/admin')
    await expect(banner.getByRole('link', { name: 'Resume', exact: true })).toHaveCount(0)
    await expect(banner.getByRole('link', { name: 'Applications', exact: true })).toHaveCount(0)
  })
})

test.describe('overview', () => {
  test('stat cards open the filtered tabs', async ({ page }) => {
    await signInAdminApi(page)
    await page.goto('/admin')
    await expect(page.getByRole('link', { name: /Candidates/ })).toBeVisible()

    await page.getByRole('link', { name: /Suspended users/ }).click()
    await expect(page).toHaveURL(/tab=users&f=suspended/)
    await expect(
      page.getByRole('group', { name: 'Filter users' }).getByRole('button', { name: 'Suspended' }),
    ).toHaveAttribute('aria-pressed', 'true')

    await page.goBack()
    await page.getByRole('link', { name: /Suspended jobs/ }).click()
    await expect(page).toHaveURL(/tab=jobs&f=suspended/)
    await expect(
      page.getByRole('group', { name: 'Filter jobs by title' }).getByRole('button', { name: 'Suspended' }),
    ).toHaveAttribute('aria-pressed', 'true')

    await page.goBack()
    await page.getByRole('link', { name: /Unverified companies/ }).click()
    await expect(page).toHaveURL(/tab=companies/)
    await expect(page.getByLabel('Search companies')).toBeVisible()
  })
})

test.describe('users tab', () => {
  test('searches, filters, suspends with a reason and restores', async ({ page, newCandidate }) => {
    const { user } = await newCandidate()
    await signInAdminApi(page)
    await page.goto('/admin?tab=users')

    await page.getByLabel('Search users').fill(user.email)
    const card = row(page, user.email)
    await expect(card).toBeVisible()
    const filters = page.getByRole('group', { name: 'Filter users' })
    await expect(filters.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')

    await filters.getByRole('button', { name: 'Employer' }).click()
    await expect(filters.getByRole('button', { name: 'Employer' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('No users match.')).toBeVisible()
    await filters.getByRole('button', { name: 'Candidate' }).click()
    await expect(card).toBeVisible()

    await card.getByRole('button', { name: 'Suspend' }).click()
    await confirmSuspend(page, `Suspend ${user.name}?`)
    await expect(page.getByText('User suspended')).toBeVisible()
    // The Candidate filter still applies; the row now shows the reason and a Restore button.
    await expect(card.getByRole('note')).toHaveText(`Suspended: ${REASON}`)
    await expect(card.getByRole('button', { name: 'Suspend' })).toHaveCount(0)

    await filters.getByRole('button', { name: 'Suspended' }).click()
    await expect(card).toBeVisible()

    await card.getByRole('button', { name: 'Restore' }).click()
    await confirmRestore(page, `Restore ${user.name}?`)
    await expect(page.getByText('User restored')).toBeVisible()
    // It no longer matches the Suspended filter, so the row drops out.
    await expect(card).toHaveCount(0)
  })

  test('can cancel the suspend dialog without suspending', async ({ page, newCandidate }) => {
    const { user } = await newCandidate()
    await signInAdminApi(page)
    await page.goto('/admin?tab=users')
    await page.getByLabel('Search users').fill(user.email)
    await row(page, user.email).getByRole('button', { name: 'Suspend' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(row(page, user.email).getByRole('note')).toHaveCount(0)
  })

  test('offers no Suspend button for admins', async ({ page }) => {
    await signInAdminApi(page)
    await page.goto('/admin?tab=users')
    await page.getByLabel('Search users').fill('admin@e2e.test')
    const card = row(page, 'admin@e2e.test')
    await expect(card).toBeVisible()
    await expect(card.getByRole('button')).toHaveCount(0)
  })
})

test.describe('jobs tab', () => {
  test('suspends a job with a reason and restores it', async ({ page, newEmployer }) => {
    const employer = await newEmployer()
    const job = await publishRareJob(employer.api)
    const title = job.content.title
    await signInAdminApi(page)
    await page.goto('/admin?tab=jobs')

    await page.getByLabel('Search jobs by title').fill(title)
    const card = row(page, title)
    await expect(card.getByRole('link', { name: title })).toBeVisible()

    await card.getByRole('button', { name: 'Suspend' }).click()
    await confirmSuspend(page, `Suspend "${title}"?`)
    await expect(page.getByText('Job suspended')).toBeVisible()
    await expect(card.getByRole('note')).toHaveText(`Suspended: ${REASON}`)
    // A suspended job is no longer linked to the public page.
    await expect(card.getByRole('link')).toHaveCount(0)

    await card.getByRole('button', { name: 'Restore' }).click()
    await confirmRestore(page, `Restore "${title}"?`)
    await expect(page.getByText('Job restored')).toBeVisible()
    await expect(card.getByRole('note')).toHaveCount(0)
    await expect(card.getByRole('link', { name: title })).toBeVisible()
  })
})

test.describe('companies tab', () => {
  test('toggles company verification', async ({ page, newEmployer }) => {
    const employer = await newEmployer()
    await signInAdminApi(page)
    await page.goto('/admin?tab=companies')
    await page.getByLabel('Search companies').fill(employer.company.name)
    const card = row(page, employer.company.name)

    await card.getByRole('button', { name: 'Mark as verified' }).click()
    await expect(page.getByText('Company verified')).toBeVisible()
    await expect(card.getByRole('button', { name: 'Remove verification' })).toBeVisible()

    await card.getByRole('button', { name: 'Remove verification' }).click()
    await expect(page.getByText('Verification removed')).toBeVisible()
    await expect(card.getByRole('button', { name: 'Mark as verified' })).toBeVisible()
  })
})

test.describe('employer view of a suspended job', () => {
  test('shows the reason on the list and hides everything but Close', async ({ page, adminApi }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishRareJob(page.request)
    expect((await suspendJobApi(adminApi, job.id)).status()).toBe(200)

    await page.goto('/employer/jobs')
    const card = row(page, job.content.title)
    await expect(card.getByRole('note')).toHaveText(
      `Suspended by an administrator and hidden from candidates: ${REASON}`,
    )
    await expect(card.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0)
    await expect(card.getByRole('button', { name: 'Unpublish' })).toHaveCount(0)
    await expect(card.getByRole('button', { name: 'Close', exact: true })).toBeVisible()
    await expect(card.getByRole('link', { name: 'Applicants' })).toBeVisible()
  })

  test('opens the editor read-only with the suspended banner', async ({ page, adminApi }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishRareJob(page.request)
    await suspendJobApi(adminApi, job.id)

    await page.goto(`/employer/jobs/${job.id}/edit`)
    await expect(page.getByRole('status').filter({ hasText: 'An administrator suspended this job' })).toContainText(REASON)
    await expect(page.getByLabel('Title')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })
})

test.describe('suspended candidate', () => {
  test('is signed out on the next refresh of their session', async ({ page, adminApi }) => {
    const user = await registerUser(page.request, { role: 'candidate' })
    await page.goto('/')
    await expect(page.getByRole('banner').getByRole('button', { name: user.name, exact: true })).toBeVisible({ timeout: 15_000 })

    const res = await adminApi.post(`/api/admin/users/${await meId(page.request)}/suspension`, {
      data: { reason: REASON },
    })
    expect(res.status()).toBe(200)

    // Query refetch-on-focus listens to visibilitychange on window.
    await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
    await expect(page.getByRole('banner').getByRole('link', { name: 'Log in' })).toBeVisible({ timeout: 15_000 })
  })

  test('sees the Account suspended toast on /login, not the unverified notice', async ({ page, adminApi, newCandidate }) => {
    const { api, user } = await newCandidate()
    await adminApi.post(`/api/admin/users/${await meId(api)}/suspension`, { data: { reason: REASON } })

    await page.goto('/login')
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Password').fill(user.password)
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page.getByText('Account suspended').first()).toBeVisible()
    await expect(page.getByText('This account has been suspended by an administrator.')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: /resend/i })).toHaveCount(0)
  })
})
