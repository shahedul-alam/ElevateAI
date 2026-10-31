import { expect, test } from './support/fixtures'
import { registerUser } from './support/auth'
import { listVersionsApi, pickTerm, saveResume } from './support/profile'

test.describe('resume page access', () => {
  test('redirects anonymous visitors to /login', async ({ page }) => {
    await page.goto('/resume')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('shows the candidate-only message to employers', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    await page.goto('/resume')
    await expect(page.getByText('The resume builder is for candidate accounts.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save resume' })).toHaveCount(0)
  })
})

test.describe('resume builder', () => {
  test('saves skills, a role and a certification and keeps them after reload', async ({
    page,
    currentUser,
  }) => {
    void currentUser
    await page.goto('/resume')
    await expect(page.getByRole('heading', { name: 'Your resume' })).toBeVisible()

    await page.getByLabel('Short professional headline').fill('Full-stack engineer')
    await pickTerm(page, 'Search skills...', 'react.js', 'React')
    await pickTerm(page, 'Search skills...', 'python', 'Python')
    await page.getByLabel('React level').selectOption('4')
    await page.getByLabel('React years').fill('3')

    await page.getByRole('button', { name: 'Add role' }).click()
    await page.getByLabel('Role title').fill('Backend developer')
    await page.getByLabel('Role domain').selectOption({ label: 'Fintech' })
    await page.getByLabel('Role years').fill('2.5')

    await pickTerm(page, 'Search certifications...', 'aws developer', 'AWS Certified Developer')
    await saveResume(page)

    await page.reload()
    await expect(page.getByLabel('Short professional headline')).toHaveValue('Full-stack engineer')
    await expect(page.getByLabel('React level')).toHaveValue('4')
    await expect(page.getByLabel('React years')).toHaveValue('3')
    await expect(page.getByLabel('Python level')).toBeVisible()
    await expect(page.getByLabel('Role title')).toHaveValue('Backend developer')
    await expect(page.getByLabel('Role domain')).toHaveValue('domain:fintech')
    await expect(page.getByLabel('Role years')).toHaveValue('2.5')
    await expect(page.getByRole('button', { name: 'Remove AWS Certified Developer' })).toBeVisible()
  })

  test('blocks saving a role without a title', async ({ page, currentUser }) => {
    void currentUser
    await page.goto('/resume')
    await page.getByRole('button', { name: 'Add role' }).click()
    await page.getByRole('button', { name: 'Save resume' }).click()
    await expect(page.getByLabel('Role title')).toHaveAttribute('aria-invalid', 'true')
    expect(await listVersionsApi(page.request)).toEqual([])
  })
})

test.describe('resume versioning', () => {
  test('saves versions, restores an older one without a new row, and ignores identical saves', async ({
    page,
    currentUser,
  }) => {
    void currentUser
    await page.goto('/resume')
    await expect(page.getByText('No versions yet')).toBeVisible()

    // Version A
    await page.getByLabel('Short professional headline').fill('Version A')
    await pickTerm(page, 'Search skills...', 'react', 'React')
    await saveResume(page)
    await expect(page.getByText('Current', { exact: true })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Restore' })).toHaveCount(0)

    // Version B
    await page.getByLabel('Short professional headline').fill('Version B')
    await pickTerm(page, 'Search skills...', 'python', 'Python')
    await saveResume(page)
    await expect(page.getByRole('button', { name: 'Restore' })).toHaveCount(1)
    await expect(page.getByText('Current', { exact: true })).toHaveCount(1)
    expect(await listVersionsApi(page.request)).toHaveLength(2)

    // Restore A
    await page.getByRole('button', { name: 'Restore' }).click()
    await expect(page.getByLabel('Short professional headline')).toHaveValue('Version A')
    await expect(page.getByLabel('React level')).toBeVisible()
    await expect(page.getByLabel('Python level')).toHaveCount(0)

    const versions = await listVersionsApi(page.request)
    expect(versions).toHaveLength(2)
    expect(versions.find((v) => v.isCurrent)?.content.headline).toBe('Version A')
    await expect(page.getByText('Current', { exact: true })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Restore' })).toHaveCount(1)

    // Saving identical content again adds nothing
    await saveResume(page)
    expect(await listVersionsApi(page.request)).toHaveLength(2)
  })
})
