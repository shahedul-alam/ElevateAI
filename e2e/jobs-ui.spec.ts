import { expect, test } from '@playwright/test'
import { registerUser } from './support/auth'
import { createJobApi, publishJobApi, uniqueTitle, type JobDto } from './support/jobs'
import { pickTerm } from './support/profile'

test.describe('employer job pages access', () => {
  test('redirects anonymous visitors to /login', async ({ page }) => {
    await page.goto('/employer/jobs')
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/employer/jobs/new')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('shows the employer-only message to candidates', async ({ page }) => {
    await registerUser(page.request, { role: 'candidate' })
    await page.goto('/employer/jobs')
    await expect(page.getByText('Posting jobs is for employer accounts.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Post a job' })).toHaveCount(0)
  })
})

test.describe('posting a job', () => {
  test('creates a draft, publishes it and shows it publicly', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const title = uniqueTitle('UI Posting')

    await page.goto('/employer/jobs')
    await expect(page.getByText('You have not posted any jobs yet.')).toBeVisible()
    await page.getByRole('link', { name: 'Post a job' }).click()
    await expect(page).toHaveURL(/\/employer\/jobs\/new$/)

    await page.getByLabel('Title', { exact: true }).fill(title)
    await page.getByLabel('Description').fill('Build great things.')
    await page.getByLabel('Work mode').selectOption('remote')
    await pickTerm(page, 'Search skills...', 'react', 'React')
    await page.getByRole('button', { name: 'Create draft' }).click()

    await expect(page).toHaveURL(/\/employer\/jobs$/)
    const row = page.getByRole('listitem').filter({ hasText: title })
    await expect(row).toContainText('Draft')

    // Not public while a draft.
    await page.goto('/jobs')
    await page.getByLabel('Search jobs').fill(title)
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page.getByText('No jobs match your search.')).toBeVisible()

    await page.goto('/employer/jobs')
    await row.getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Job published')).toBeVisible()
    await expect(row).toContainText('Active')

    await page.goto('/jobs')
    await page.getByLabel('Search jobs').fill(title)
    await page.getByRole('button', { name: 'Search' }).click()
    await page.getByRole('link', { name: new RegExp(title) }).click()

    await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]+$/)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Required skills' })).toBeVisible()
    await expect(page.getByText(/^React · /)).toBeVisible()
  })

  test('blocks submitting an empty title', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    await page.goto('/employer/jobs/new')
    await page.getByLabel('Description').fill('No title here.')
    await page.getByRole('button', { name: 'Create draft' }).click()
    await expect(page.getByLabel('Title', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await expect(page).toHaveURL(/\/employer\/jobs\/new$/)

    const list = await page.request.get('/api/employer/jobs')
    expect((await list.json()).jobs).toEqual([])
  })

  test('shows an error toast when publishing a job with no requirement', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await createJobApi(page.request, { skills: [] })

    await page.goto('/employer/jobs')
    const row = page.getByRole('listitem').filter({ hasText: job.content.title })
    await row.getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Could not publish job')).toBeVisible()
    await expect(row).toContainText('Draft')
  })
})

test.describe('managing published jobs', () => {
  test('unpublishes and closes a job, removing it from the public list', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishJobApi(page.request)

    await page.goto('/employer/jobs')
    const row = page.getByRole('listitem').filter({ hasText: job.content.title })
    await expect(row).toContainText('Active')

    await row.getByRole('button', { name: 'Unpublish' }).click()
    await expect(row).toContainText('Draft')
    expect((await page.request.get(`/api/jobs/${job.id}`)).status()).toBe(404)

    await row.getByRole('button', { name: 'Publish' }).click()
    await expect(row).toContainText('Active')

    page.once('dialog', (dialog) => dialog.accept())
    await row.getByRole('button', { name: 'Close' }).click()
    await expect(row).toContainText('Closed')
    await expect(row.getByRole('button')).toHaveCount(0)
    expect((await page.request.get(`/api/jobs/${job.id}`)).status()).toBe(404)
  })

  test('editing an active job updates its public detail page', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishJobApi(page.request)
    const newTitle = uniqueTitle('UI Renamed')

    await page.goto(`/employer/jobs/${job.id}/edit`)
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(job.content.title)
    await page.getByLabel('Title', { exact: true }).fill(newTitle)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Job saved')).toBeVisible()

    await page.goto(`/jobs/${job.id}`)
    await expect(page.getByRole('heading', { name: newTitle })).toBeVisible()
  })

  test('shows an error when an active job is edited down to no requirements', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job: JobDto = await publishJobApi(page.request)

    await page.goto(`/employer/jobs/${job.id}/edit`)
    await page.getByRole('button', { name: 'Remove React' }).click()
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Could not save')).toBeVisible()

    const detail = await page.request.get(`/api/jobs/${job.id}`)
    expect((await detail.json()).job.content.skills).toHaveLength(1)
  })
})

test.describe('public job pages', () => {
  test('shows a not-available message for a job that is not public', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const draft = await createJobApi(page.request)
    await page.goto(`/jobs/${draft.id}`)
    await expect(page.getByText('This job is not available.')).toBeVisible()
    await page.goto('/jobs/not-a-uuid')
    await expect(page.getByText('This job is not available.')).toBeVisible()
  })

  test('filters the list by work mode', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const token = uniqueTitle('Filter')
    const remote = await publishJobApi(page.request, { title: `${token} Remote`, workMode: 'remote' })
    await publishJobApi(page.request, { title: `${token} Onsite`, workMode: 'onsite' })
    await page.context().clearCookies()

    await page.goto('/jobs')
    await page.getByLabel('Search jobs').fill(token)
    await page.getByLabel('Work mode').selectOption('remote')
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page.getByRole('link', { name: new RegExp(remote.content.title) })).toBeVisible()
    await expect(page.getByRole('link', { name: /Onsite/ })).toHaveCount(0)

    await page.getByLabel('Work mode').selectOption('')
    await expect(page.getByRole('link', { name: /Onsite/ })).toBeVisible()
  })
})
