import { expect, test, type Page } from '@playwright/test'
import { registerUser } from './support/auth'
import { createJobApi, jobAction, publishJobApi, uniqueTitle } from './support/jobs'

const rowFor = (page: Page, title: string) => page.getByRole('listitem').filter({ hasText: title })

/** Counts native browser dialogs (confirm/alert); the app must use its own modals instead. */
function trackNativeDialogs(page: Page) {
  const seen = { count: 0 }
  page.on('dialog', (dialog) => {
    seen.count += 1
    void dialog.dismiss()
  })
  return seen
}

test.describe('employer jobs: row actions', () => {
  test('has no View or Preview button on any row', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const draft = await createJobApi(page.request)
    const active = await publishJobApi(page.request)
    const closed = await publishJobApi(page.request)
    await jobAction(page.request, closed.id, 'close')

    await page.goto('/employer/jobs')
    for (const job of [draft, active, closed]) {
      await expect(rowFor(page, job.content.title)).toBeVisible()
    }
    await expect(page.getByRole('button', { name: /^(View|Preview)$/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /^(View|Preview)$/ })).toHaveCount(0)
  })

  test('opens the preview when a draft, active or closed job card is clicked', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const draft = await createJobApi(page.request)
    const active = await publishJobApi(page.request)
    const closed = await publishJobApi(page.request)
    await jobAction(page.request, closed.id, 'close')

    for (const job of [draft, active, closed]) {
      await page.goto('/employer/jobs')
      await page.getByRole('link', { name: job.content.title }).click()
      await expect(page).toHaveURL(new RegExp(`/employer/jobs/${job.id}/edit\\?tab=preview$`))
      await expect(page.getByRole('tab', { name: 'Preview' })).toHaveAttribute('aria-selected', 'true')
      await expect(page.getByRole('heading', { name: job.content.title })).toBeVisible()
    }
  })

  test('Edit opens the form without going through the preview', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await createJobApi(page.request)
    await page.goto('/employer/jobs')

    const visited: string[] = []
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) visited.push(frame.url())
    })
    await rowFor(page, job.content.title).getByRole('link', { name: 'Edit' }).click()
    await expect(page).toHaveURL(new RegExp(`/employer/jobs/${job.id}/edit$`))
    await expect(page.getByRole('tab', { name: 'Edit' })).toHaveAttribute('aria-selected', 'true')
    expect(visited.filter((u) => u.includes('tab=preview'))).toEqual([])
  })

  test('Applicants opens the applicants page without going through the preview', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishJobApi(page.request)
    await page.goto('/employer/jobs')

    const visited: string[] = []
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) visited.push(frame.url())
    })
    await rowFor(page, job.content.title).getByRole('link', { name: 'Applicants' }).click()
    await expect(page).toHaveURL(new RegExp(`/employer/jobs/${job.id}/applicants$`))
    expect(visited.filter((u) => u.includes('/edit'))).toEqual([])
  })

  test('Publish changes the status and stays on the list', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await createJobApi(page.request)
    await page.goto('/employer/jobs')

    await rowFor(page, job.content.title).getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Job published')).toBeVisible()
    await expect(rowFor(page, job.content.title)).toContainText('Active')
    await expect(page).toHaveURL(/\/employer\/jobs$/)
  })

  test('a closed job row only offers Applicants', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishJobApi(page.request)
    await jobAction(page.request, job.id, 'close')
    await page.goto('/employer/jobs')

    const row = rowFor(page, job.content.title)
    await expect(row).toContainText('Closed')
    await expect(row.getByRole('link', { name: 'Applicants' })).toBeVisible()
    await expect(row.getByRole('link', { name: 'Edit' })).toHaveCount(0)
    await expect(row.getByRole('button')).toHaveCount(0)
  })
})

test.describe('employer jobs: search, filter and sort', () => {
  test('searches by title, ignoring case', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const token = uniqueTitle('Search').replace(/\s/g, '')
    const match = await createJobApi(page.request, { title: `Senior ${token}Alpha` })
    const other = await createJobApi(page.request, { title: uniqueTitle('Unrelated') })

    await page.goto('/employer/jobs')
    await page.getByLabel('Search your jobs').fill(token.toUpperCase())
    await expect(rowFor(page, match.content.title)).toBeVisible()
    await expect(rowFor(page, other.content.title)).toHaveCount(0)
    await expect(page).toHaveURL(new RegExp(`q=${token.toUpperCase()}`))
  })

  test('filters by status and shows counts that ignore the search text', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const token = uniqueTitle('Status').replace(/\s/g, '')
    const draft = await createJobApi(page.request, { title: `${token} Draft` })
    const activeA = await publishJobApi(page.request, { title: `${token} ActiveA` })
    const activeB = await publishJobApi(page.request, { title: `${token} ActiveB` })
    const closed = await publishJobApi(page.request, { title: `${token} Closed` })
    await jobAction(page.request, closed.id, 'close')

    await page.goto('/employer/jobs')
    await expect(page.getByRole('button', { name: 'All (4)' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Draft (1)' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Active (2)' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Closed (1)' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'All (4)' })).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('button', { name: 'Active (2)' }).click()
    await expect(page).toHaveURL(/status=active/)
    await expect(page.getByRole('button', { name: 'Active (2)' })).toHaveAttribute('aria-pressed', 'true')
    await expect(rowFor(page, activeA.content.title)).toBeVisible()
    await expect(rowFor(page, activeB.content.title)).toBeVisible()
    await expect(rowFor(page, draft.content.title)).toHaveCount(0)
    await expect(rowFor(page, closed.content.title)).toHaveCount(0)

    await page.getByRole('button', { name: 'Draft (1)' }).click()
    await expect(rowFor(page, draft.content.title)).toBeVisible()
    await expect(rowFor(page, activeA.content.title)).toHaveCount(0)

    await page.getByRole('button', { name: 'Closed (1)' }).click()
    await expect(rowFor(page, closed.content.title)).toBeVisible()
    await expect(rowFor(page, draft.content.title)).toHaveCount(0)

    // Searching narrows the list but not the counts.
    await page.getByRole('button', { name: 'All (4)' }).click()
    await page.getByLabel('Search your jobs').fill('ActiveA')
    await expect(rowFor(page, activeA.content.title)).toBeVisible()
    await expect(rowFor(page, activeB.content.title)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'All (4)' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Active (2)' })).toBeVisible()
  })

  test('sorts by recent update, oldest update and title', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const token = uniqueTitle('Sort').replace(/\s/g, '')
    const bravo = await createJobApi(page.request, { title: `${token} Bravo` })
    const alpha = await createJobApi(page.request, { title: `${token} Alpha` })
    const charlie = await createJobApi(page.request, { title: `${token} Charlie` })
    // Touch Bravo last so it becomes the most recently updated.
    const res = await page.request.put(`/api/employer/jobs/${bravo.id}`, {
      data: { ...bravo.content, description: 'Touched later.' },
    })
    expect(res.status(), await res.text()).toBe(200)

    await page.goto('/employer/jobs')
    await page.getByLabel('Search your jobs').fill(token)
    const order = () => page.getByRole('listitem').getByRole('link', { name: new RegExp(token) }).allTextContents()
    const expectOrder = (expected: string[]) => expect.poll(order).toEqual(expected)

    await expectOrder([bravo.content.title, charlie.content.title, alpha.content.title])

    await page.getByLabel('Sort jobs').selectOption({ label: 'Oldest updated' })
    await expect(page).toHaveURL(/sort=oldest/)
    await expectOrder([alpha.content.title, charlie.content.title, bravo.content.title])

    await page.getByLabel('Sort jobs').selectOption({ label: 'Title A to Z' })
    await expect(page).toHaveURL(/sort=title/)
    await expectOrder([alpha.content.title, bravo.content.title, charlie.content.title])

    await page.getByLabel('Sort jobs').selectOption({ label: 'Recently updated' })
    await expect(page).not.toHaveURL(/sort=/)
  })

  test('keeps search, status and sort in the URL across a reload', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const token = uniqueTitle('Persist').replace(/\s/g, '')
    const keep = await publishJobApi(page.request, { title: `${token} Keep` })
    await createJobApi(page.request, { title: `${token} DraftOne` })

    await page.goto('/employer/jobs')
    await page.getByLabel('Search your jobs').fill(token)
    await page.getByRole('button', { name: /^Active/ }).click()
    await page.getByLabel('Sort jobs').selectOption({ label: 'Title A to Z' })
    await expect(page).toHaveURL(new RegExp(`q=${token}`))
    await expect(page).toHaveURL(/status=active/)
    await expect(page).toHaveURL(/sort=title/)

    await page.reload()
    await expect(page.getByLabel('Search your jobs')).toHaveValue(token)
    await expect(page.getByRole('button', { name: /^Active/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Sort jobs')).toHaveValue('title')
    await expect(rowFor(page, keep.content.title)).toBeVisible()
    await expect(rowFor(page, `${token} DraftOne`)).toHaveCount(0)
  })

  test('applies filters given in the URL and ignores invalid values', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const draft = await createJobApi(page.request)
    const active = await publishJobApi(page.request)

    await page.goto('/employer/jobs?status=draft')
    await expect(rowFor(page, draft.content.title)).toBeVisible()
    await expect(rowFor(page, active.content.title)).toHaveCount(0)

    await page.goto('/employer/jobs?status=bogus&sort=bogus')
    await expect(page.getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Sort jobs')).toHaveValue('updated')
    await expect(rowFor(page, draft.content.title)).toBeVisible()
    await expect(rowFor(page, active.content.title)).toBeVisible()
  })

  test('shows an empty state and Clear filters restores the list', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await createJobApi(page.request)

    await page.goto('/employer/jobs')
    await page.getByLabel('Search your jobs').fill('zzz-no-such-title')
    await expect(page.getByText('No jobs match your filters.')).toBeVisible()
    await expect(rowFor(page, job.content.title)).toHaveCount(0)

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.getByText('No jobs match your filters.')).toHaveCount(0)
    await expect(page.getByLabel('Search your jobs')).toHaveValue('')
    await expect(page).toHaveURL(/\/employer\/jobs$/)
    await expect(rowFor(page, job.content.title)).toBeVisible()
  })

  test('an empty status filter also shows the empty state', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await createJobApi(page.request)

    await page.goto('/employer/jobs')
    await page.getByRole('button', { name: 'Closed (0)' }).click()
    await expect(page.getByText('No jobs match your filters.')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(rowFor(page, job.content.title)).toBeVisible()
  })
})

test.describe('employer jobs: close confirmation', () => {
  test('Cancel keeps the job active', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const dialogs = trackNativeDialogs(page)
    const job = await publishJobApi(page.request)
    await page.goto('/employer/jobs')

    const row = rowFor(page, job.content.title)
    await row.getByRole('button', { name: 'Close' }).click()
    const modal = page.getByRole('alertdialog', { name: `Close "${job.content.title}"?` })
    await expect(modal).toBeVisible()
    await modal.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(row).toContainText('Active')
    expect((await page.request.get(`/api/jobs/${job.id}`)).status()).toBe(200)
    expect(dialogs.count).toBe(0)
  })

  test('Escape keeps the job active', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const dialogs = trackNativeDialogs(page)
    const job = await publishJobApi(page.request)
    await page.goto('/employer/jobs')

    const row = rowFor(page, job.content.title)
    await row.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.keyboard.press('Escape')

    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(row).toContainText('Active')
    expect((await page.request.get(`/api/jobs/${job.id}`)).status()).toBe(200)
    expect(dialogs.count).toBe(0)
  })

  test('Close job closes it and the row shows Closed', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const dialogs = trackNativeDialogs(page)
    const job = await publishJobApi(page.request)
    await page.goto('/employer/jobs')

    const row = rowFor(page, job.content.title)
    await row.getByRole('button', { name: 'Close' }).click()
    const modal = page.getByRole('alertdialog', { name: `Close "${job.content.title}"?` })
    await expect(modal).toContainText('cannot be edited or reopened')
    await modal.getByRole('button', { name: 'Close job' }).click()

    await expect(page.getByText('Job closed')).toBeVisible()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(row).toContainText('Closed')
    expect((await page.request.get(`/api/jobs/${job.id}`)).status()).toBe(404)
    expect(dialogs.count).toBe(0)
  })

  test('names the job the dialog was opened for when several are listed', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const first = await publishJobApi(page.request)
    const second = await publishJobApi(page.request)
    await page.goto('/employer/jobs')

    await rowFor(page, second.content.title).getByRole('button', { name: 'Close' }).click()
    await page.getByRole('alertdialog', { name: `Close "${second.content.title}"?` }).getByRole('button', { name: 'Close job' }).click()
    await expect(rowFor(page, second.content.title)).toContainText('Closed')
    await expect(rowFor(page, first.content.title)).toContainText('Active')
  })

  test('clicking Close does not open the preview', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishJobApi(page.request)
    await page.goto('/employer/jobs')

    await rowFor(page, job.content.title).getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(page).toHaveURL(/\/employer\/jobs$/)
  })
})
