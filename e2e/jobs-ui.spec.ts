import { expect, test, type Page } from '@playwright/test'
import { registerUser } from './support/auth'
import { createJobApi, jobAction, publishJobApi, uniqueTitle, type JobDto } from './support/jobs'
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

    await row.getByRole('button', { name: 'Close' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Close job' }).click()
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

// The four list cards, in page order. Each has one "Add" button.
const LISTS = [
  'Key responsibilities',
  'Qualifications',
  'Perks & employee benefits',
  'Other details',
] as const

const addRow = (page: Page, list: (typeof LISTS)[number]) =>
  page.getByRole('button', { name: 'Add', exact: true }).nth(LISTS.indexOf(list)).click()

const fieldValue = (page: Page, list: (typeof LISTS)[number], n: number) =>
  page.getByLabel(`${list} ${n}`, { exact: true })

test.describe('job form: details and lists', () => {
  test('saves employment type, deadline and list rows, dropping blank rows', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await createJobApi(page.request)

    await page.goto(`/employer/jobs/${job.id}/edit`)
    await page.getByLabel('Employment type').selectOption('part_time')
    await page.getByLabel('Application deadline').fill('2027-03-15')

    await addRow(page, 'Key responsibilities')
    await fieldValue(page, 'Key responsibilities', 1).fill('Own checkout')
    await addRow(page, 'Key responsibilities')
    await fieldValue(page, 'Key responsibilities', 2).fill('   ')
    await addRow(page, 'Key responsibilities')
    await fieldValue(page, 'Key responsibilities', 3).fill('  Review code  ')

    await addRow(page, 'Qualifications')
    await fieldValue(page, 'Qualifications', 1).fill('Payments experience')
    await addRow(page, 'Perks & employee benefits')
    await fieldValue(page, 'Perks & employee benefits', 1).fill('25 days leave')
    await addRow(page, 'Other details')
    await fieldValue(page, 'Other details', 1).fill('Visa support')

    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Job saved')).toBeVisible()

    const own = await page.request.get(`/api/employer/jobs/${job.id}`)
    const content = ((await own.json()).job as JobDto).content
    expect(content.employmentType).toBe('part_time')
    expect(content.applicationDeadline).toBe('2027-03-15')
    expect(content.responsibilities).toEqual(['Own checkout', 'Review code'])
    expect(content.qualifications).toEqual(['Payments experience'])
    expect(content.perks).toEqual(['25 days leave'])
    expect(content.otherDetails).toEqual(['Visa support'])

    // Reloading shows the saved values in the form.
    await page.reload()
    await expect(page.getByLabel('Employment type')).toHaveValue('part_time')
    await expect(page.getByLabel('Application deadline')).toHaveValue('2027-03-15')
    await expect(fieldValue(page, 'Key responsibilities', 2)).toHaveValue('Review code')
    await expect(fieldValue(page, 'Key responsibilities', 3)).toHaveCount(0)
  })

  test('removes a row from a list', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await createJobApi(page.request, { perks: ['First perk', 'Second perk', 'Third perk'] })

    await page.goto(`/employer/jobs/${job.id}/edit`)
    await expect(fieldValue(page, 'Perks & employee benefits', 3)).toHaveValue('Third perk')
    await page.getByRole('button', { name: 'Remove Perks & employee benefits 2' }).click()
    await expect(fieldValue(page, 'Perks & employee benefits', 3)).toHaveCount(0)
    await expect(fieldValue(page, 'Perks & employee benefits', 2)).toHaveValue('Third perk')

    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Job saved')).toBeVisible()
    const own = await page.request.get(`/api/employer/jobs/${job.id}`)
    expect(((await own.json()).job as JobDto).content.perks).toEqual(['First perk', 'Third perk'])
  })

  test('stops offering Add at 20 rows', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    await page.goto('/employer/jobs/new')
    const add = page.getByRole('button', { name: 'Add', exact: true }).nth(LISTS.indexOf('Other details'))
    for (let i = 0; i < 20; i += 1) await add.click()
    await expect(fieldValue(page, 'Other details', 20)).toBeVisible()
    await expect(add).toBeDisabled()
  })

  test('creates a draft with the new fields from the new-job form', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const title = uniqueTitle('UI Details')
    await page.goto('/employer/jobs/new')
    await page.getByLabel('Title', { exact: true }).fill(title)
    await page.getByLabel('Description').fill('Details test.')
    await page.getByLabel('Employment type').selectOption('internship')
    await addRow(page, 'Perks & employee benefits')
    await fieldValue(page, 'Perks & employee benefits', 1).fill('Mentoring')
    await page.getByRole('button', { name: 'Create draft' }).click()
    await expect(page).toHaveURL(/\/employer\/jobs$/)

    const list = await page.request.get('/api/employer/jobs')
    const summary = ((await list.json()).jobs as { id: string; title: string }[]).find((j) => j.title === title)
    expect(summary).toBeDefined()
    const own = await page.request.get(`/api/employer/jobs/${summary!.id}`)
    const content = ((await own.json()).job as JobDto).content
    expect(content.employmentType).toBe('internship')
    expect(content.perks).toEqual(['Mentoring'])
  })
})

test.describe('job form: preview tab', () => {
  test('shows unsaved edits in the preview and keeps the form input when switching back', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await createJobApi(page.request, { perks: ['Saved perk'] })
    const newTitle = uniqueTitle('Unsaved Title')

    await page.goto(`/employer/jobs/${job.id}/edit`)
    await expect(page.getByRole('tab', { name: 'Edit' })).toHaveAttribute('aria-selected', 'true')
    await page.getByLabel('Title', { exact: true }).fill(newTitle)
    await addRow(page, 'Perks & employee benefits')
    await fieldValue(page, 'Perks & employee benefits', 2).fill('Unsaved perk')

    await page.getByRole('tab', { name: 'Preview' }).click()
    await expect(page).toHaveURL(/tab=preview/)
    await expect(page.getByRole('tab', { name: 'Preview' })).toHaveAttribute('aria-selected', 'true')
    const preview = page.getByRole('tabpanel', { name: 'Preview' })
    await expect(preview.getByText(/including your unsaved changes/)).toBeVisible()
    await expect(preview.getByRole('heading', { name: newTitle })).toBeVisible()
    await expect(preview.getByText('Saved perk', { exact: true })).toBeVisible()
    await expect(preview.getByText('Unsaved perk', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Title', { exact: true })).toBeHidden()

    await page.getByRole('tab', { name: 'Edit' }).click()
    await expect(page).not.toHaveURL(/tab=preview/)
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(newTitle)
    await expect(fieldValue(page, 'Perks & employee benefits', 2)).toHaveValue('Unsaved perk')

    // Nothing was saved by previewing.
    const own = await page.request.get(`/api/employer/jobs/${job.id}`)
    const saved = ((await own.json()).job as JobDto).content
    expect(saved.title).toBe(job.content.title)
    expect(saved.perks).toEqual(['Saved perk'])
  })

  test('the preview omits blank rows and shows the chosen type and deadline', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await createJobApi(page.request)

    await page.goto(`/employer/jobs/${job.id}/edit`)
    await page.getByLabel('Employment type').selectOption('contract')
    await page.getByLabel('Application deadline').fill('2027-03-15')
    await addRow(page, 'Qualifications')
    await addRow(page, 'Other details')
    await fieldValue(page, 'Other details', 1).fill('Remote interview')

    await page.getByRole('tab', { name: 'Preview' }).click()
    const preview = page.getByRole('tabpanel', { name: 'Preview' })
    await expect(preview.getByText('Contract', { exact: true })).toBeVisible()
    await expect(preview.getByText(/Apply by Mar 15, 2027/)).toBeVisible()
    await expect(preview.getByText('Remote interview')).toBeVisible()
    await expect(preview.getByText('Other details', { exact: true })).toBeVisible()
    await expect(preview.getByText('Qualifications', { exact: true })).toHaveCount(0)
  })

  test('keeps the preview tab across a reload', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await createJobApi(page.request)

    await page.goto(`/employer/jobs/${job.id}/edit?tab=preview`)
    await expect(page.getByRole('heading', { name: job.content.title })).toBeVisible()
    await page.reload()
    await expect(page).toHaveURL(/tab=preview/)
    await expect(page.getByRole('tab', { name: 'Preview' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { name: job.content.title })).toBeVisible()
    await expect(page.getByLabel('Title', { exact: true })).toBeHidden()
  })

  test('opens a closed job read-only with a working preview', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishJobApi(page.request, { perks: ['Closed perk'] })
    expect((await jobAction(page.request, job.id, 'close')).status()).toBe(200)

    await page.goto(`/employer/jobs/${job.id}/edit`)
    await expect(page.getByText(/This job is closed and can no longer be edited/)).toBeVisible()
    await expect(page.getByLabel('Title', { exact: true })).toBeDisabled()
    await expect(page.getByLabel('Employment type')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()

    await page.getByRole('tab', { name: 'Preview' }).click()
    const preview = page.getByRole('tabpanel', { name: 'Preview' })
    await expect(preview.getByRole('heading', { name: job.content.title })).toBeVisible()
    await expect(preview.getByText('Closed perk')).toBeVisible()
  })
})

test.describe('public job page: details', () => {
  test('shows the type chip, deadline and only the non-empty sections', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishJobApi(page.request, {
      employmentType: 'internship',
      applicationDeadline: '2027-03-15',
      responsibilities: ['Own checkout', 'Review code'],
      perks: ['25 days leave'],
    })
    await page.context().clearCookies()

    await page.goto(`/jobs/${job.id}`)
    await expect(page.getByRole('heading', { name: job.content.title })).toBeVisible()
    await expect(page.getByText('Internship', { exact: true })).toBeVisible()
    await expect(page.getByText(/Apply by Mar 15, 2027/)).toBeVisible()
    await expect(page.getByText('Key responsibilities', { exact: true })).toBeVisible()
    await expect(page.getByText('Own checkout')).toBeVisible()
    await expect(page.getByText('Review code')).toBeVisible()
    await expect(page.getByText('Perks & benefits', { exact: true })).toBeVisible()
    await expect(page.getByText('25 days leave')).toBeVisible()
    await expect(page.getByText('Qualifications', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Other details', { exact: true })).toHaveCount(0)
  })

  test('shows no new sections, chip or deadline for a job without them', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishJobApi(page.request)
    await page.context().clearCookies()

    await page.goto(`/jobs/${job.id}`)
    await expect(page.getByRole('heading', { name: job.content.title })).toBeVisible()
    await expect(page.getByText(/Apply by/)).toHaveCount(0)
    for (const text of ['Key responsibilities', 'Qualifications', 'Perks & benefits', 'Other details']) {
      await expect(page.getByText(text, { exact: true })).toHaveCount(0)
    }
    for (const text of ['Full time', 'Part time', 'Contract', 'Internship']) {
      await expect(page.getByText(text, { exact: true })).toHaveCount(0)
    }
  })
})

test.describe('/jobs employment type', () => {
  test('filters by employment type and shows the type on each card', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const token = uniqueTitle('TypeFilter')
    const contract = await publishJobApi(page.request, { title: `${token} Contract`, employmentType: 'contract' })
    await publishJobApi(page.request, { title: `${token} Intern`, employmentType: 'internship' })
    await page.context().clearCookies()

    await page.goto('/jobs')
    await page.getByLabel('Search jobs').fill(token)
    await page.getByRole('button', { name: 'Search' }).click()
    const contractCard = page.getByRole('listitem').filter({ hasText: contract.content.title })
    await expect(contractCard).toContainText('Contract')
    await expect(page.getByRole('link', { name: /Intern$/ })).toBeVisible()

    await page.getByLabel('Employment type').selectOption('contract')
    await expect(page.getByRole('link', { name: new RegExp(contract.content.title) })).toBeVisible()
    await expect(page.getByRole('link', { name: /Intern$/ })).toHaveCount(0)

    await page.getByLabel('Employment type').selectOption('part_time')
    await expect(page.getByText('No jobs match your search.')).toBeVisible()

    await page.getByLabel('Employment type').selectOption('')
    await expect(page.getByRole('link', { name: /Intern$/ })).toBeVisible()
  })
})
