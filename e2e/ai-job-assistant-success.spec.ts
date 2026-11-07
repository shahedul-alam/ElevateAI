import { expect, test } from '@playwright/test'
import { STUB_FAIL } from './support/ai'
import { grantAiConsent, registerUser } from './support/auth'

// AI_STUB is on: every draft is the canned 'Stub Platform Engineer' posting.
const POSTING = 'We are hiring a platform engineer to build and run our services.'
const DRAFT_URL = '/api/employer/jobs/ai-draft'

test.describe('job assistant API with the stubbed model', () => {
  test('returns the canned draft, the unmapped skill and term names', async ({ request }) => {
    await registerUser(request, { role: 'employer' })
    await grantAiConsent(request)

    const res = await request.post(DRAFT_URL, { data: { text: POSTING } })
    expect(res.status(), await res.text()).toBe(200)
    const body = await res.json()
    expect(body.draft).toMatchObject({
      title: 'Stub Platform Engineer',
      employmentType: 'full_time',
      skills: [
        { termId: 'skill:react', required: true },
        { termId: 'skill:typescript', required: true },
        { termId: 'skill:graphql', required: false },
      ],
    })
    for (const list of ['responsibilities', 'qualifications', 'perks', 'otherDetails']) {
      expect(body.draft[list], list).toHaveLength(2)
    }
    // Scored requirements other than skills are never drafted.
    for (const key of ['minYears', 'minDegreeLevel', 'certIds', 'salaryMin', 'location']) {
      expect(body.draft).not.toHaveProperty(key)
    }
    expect(body.unmappedSkills).toEqual(['Zorblax'])
    expect(body.termNames['skill:graphql']).toBe('GraphQL')
  })

  test('answers 502 when the posting contains the failure marker', async ({ request }) => {
    await registerUser(request, { role: 'employer' })
    await grantAiConsent(request)
    const res = await request.post(DRAFT_URL, { data: { text: `${POSTING} ${STUB_FAIL}` } })
    expect(res.status()).toBe(502)
  })
})

test.describe('Draft with AI card with the stubbed model', () => {
  test('asks for consent, fills the form unsaved and creates the job with the drafted skills', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    await page.goto('/employer/jobs/new')

    await page.getByLabel('Pasted posting text').fill(POSTING)
    await page.getByRole('button', { name: 'Draft with AI' }).click()
    const consent = page.getByRole('alertdialog')
    await expect(consent.getByText('Use AI features?')).toBeVisible()
    await consent.getByRole('button', { name: 'Agree and continue' }).click()

    await expect(page.getByText('Draft added to the form')).toBeVisible()
    await expect(page.getByText(/Not in our catalog: Zorblax/)).toBeVisible()
    await expect(page.getByText('Unsaved changes')).toBeVisible()
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Stub Platform Engineer')
    await expect(page.getByLabel('Description', { exact: true })).toHaveValue(/platform team/)
    await expect(page.getByLabel('Employment type')).toHaveValue('full_time')
    await expect(page.getByLabel('Key responsibilities 1', { exact: true })).toHaveValue('Build internal tools.')
    await expect(page.getByLabel('Key responsibilities 2', { exact: true })).toHaveValue('Review pull requests.')
    await expect(page.getByLabel('Qualifications 2', { exact: true })).toHaveValue('Comfortable with TypeScript.')
    await expect(page.getByLabel('Perks & employee benefits 1', { exact: true })).toHaveValue('Health insurance.')
    await expect(page.getByLabel('Other details 2', { exact: true })).toHaveValue('Part of the platform team.')
    await expect(page.getByLabel('React required')).toBeChecked()
    await expect(page.getByLabel('TypeScript required')).toBeChecked()
    await expect(page.getByLabel('GraphQL required')).not.toBeChecked()

    const created = page.waitForResponse((r) => r.url().endsWith('/api/employer/jobs') && r.request().method() === 'POST')
    await page.getByRole('button', { name: 'Create draft' }).click()
    const response = await created
    expect(response.status(), await response.text()).toBe(201)
    const { job } = await response.json()
    expect(job.content).toMatchObject({
      title: 'Stub Platform Engineer',
      employmentType: 'full_time',
      // Saved jobs store skills sorted by id (canonicalizeJob), whatever order the draft had.
      skills: [
        { termId: 'skill:graphql', required: false },
        { termId: 'skill:react', required: true },
        { termId: 'skill:typescript', required: true },
      ],
    })
    expect(job.status).toBe('draft')
  })

  test('asks before replacing a form with content and keeps scored fields', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    await grantAiConsent(page.request)
    await page.goto('/employer/jobs/new')

    const title = page.getByLabel('Title', { exact: true })
    await title.fill('Existing title')
    await page.getByLabel('Minimum total experience (years)').fill('7')
    await page.getByLabel('Pasted posting text').fill(POSTING)
    await page.getByRole('button', { name: 'Draft with AI' }).click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByText('Replace what is in the form?')).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    await expect(title).toHaveValue('Existing title')

    await page.getByRole('button', { name: 'Draft with AI' }).click()
    await dialog.getByRole('button', { name: 'Use draft' }).click()
    await expect(title).toHaveValue('Stub Platform Engineer')
    await expect(page.getByLabel('Minimum total experience (years)')).toHaveValue('7')
  })

  test('shows an error toast and leaves the form alone when the model fails', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    await grantAiConsent(page.request)
    await page.goto('/employer/jobs/new')

    await page.getByLabel('Pasted posting text').fill(`${POSTING} ${STUB_FAIL}`)
    await page.getByRole('button', { name: 'Draft with AI' }).click()
    await expect(page.getByText('Could not draft')).toBeVisible()
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('')
    await expect(page.getByText('Unsaved changes')).toHaveCount(0)
  })
})
