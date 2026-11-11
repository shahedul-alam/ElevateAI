import { expect, type Page } from '@playwright/test'
import { test } from './support/company'
import { REASON, listAuditApi, meId, signInAdminApi, suspendUserApi } from './support/admin'

const row = (page: Page, text: string) => page.getByRole('listitem').filter({ hasText: text })

test.describe('audit tab', () => {
  test('lists entries, searches and filters by action', async ({ page, adminApi, newCandidate }) => {
    const { api, user } = await newCandidate()
    await suspendUserApi(adminApi, await meId(api))
    await signInAdminApi(page)

    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Audit' }).click()
    await expect(page).toHaveURL(/tab=audit/)

    await page.getByLabel('Search audit log').fill(user.email)
    const entry = row(page, user.email)
    await expect(entry).toContainText('user suspend')
    await expect(entry).toContainText('by admin@e2e.test')
    await expect(entry).toContainText(REASON)

    const filters = page.getByRole('group', { name: 'Filter audit log' })
    await filters.getByRole('button', { name: 'user restore' }).click()
    await expect(filters.getByRole('button', { name: 'user restore' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('No entries match.')).toBeVisible()
    await filters.getByRole('button', { name: 'user suspend' }).click()
    await expect(entry).toBeVisible()
  })

  test('shows a UI-made verification in the log', async ({ page, newEmployer }) => {
    const employer = await newEmployer()
    await signInAdminApi(page)
    await page.goto('/admin?tab=companies')
    await page.getByLabel('Search companies').fill(employer.company.name)
    await row(page, employer.company.name).getByRole('button', { name: 'Mark as verified' }).click()
    await expect(page.getByText('Company verified')).toBeVisible()

    await page.goto('/admin?tab=audit')
    await page.getByLabel('Search audit log').fill(employer.company.name)
    await expect(row(page, employer.company.name)).toContainText('company verify')
  })
})

test.describe('delete user', () => {
  test('needs the typed email, deletes, and logs it', async ({ page, adminApi, newCandidate }) => {
    const { user } = await newCandidate()
    await signInAdminApi(page)
    await page.goto('/admin?tab=users')
    await page.getByLabel('Search users').fill(user.email)
    await row(page, user.email).getByRole('button', { name: 'Delete' }).click()

    const dialog = page.getByRole('alertdialog', { name: `Delete ${user.name} permanently?` })
    const submit = dialog.getByRole('button', { name: 'Delete', exact: true })
    await expect(submit).toBeDisabled()
    await dialog.getByLabel(`Type ${user.email} to confirm`).fill('wrong@e2e.test')
    await expect(submit).toBeDisabled()
    await dialog.getByLabel(`Type ${user.email} to confirm`).fill(user.email)
    await expect(submit).toBeEnabled()
    await submit.click()

    await expect(page.getByText('User deleted')).toBeVisible()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(row(page, user.email)).toHaveCount(0)

    const { entries } = await listAuditApi(adminApi, { q: user.email, action: 'user.delete' })
    expect(entries).toHaveLength(1)
  })

  test('can be cancelled without deleting', async ({ page, newCandidate }) => {
    const { user } = await newCandidate()
    await signInAdminApi(page)
    await page.goto('/admin?tab=users')
    await page.getByLabel('Search users').fill(user.email)
    await row(page, user.email).getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(row(page, user.email)).toBeVisible()
  })

  test('offers Delete for neither admins nor yourself', async ({ page }) => {
    await signInAdminApi(page)
    await page.goto('/admin?tab=users')
    await page.getByLabel('Search users').fill('admin@e2e.test')
    const card = row(page, 'admin@e2e.test')
    await expect(card).toBeVisible()
    await expect(card.getByRole('button', { name: 'Delete' })).toHaveCount(0)
  })
})
