import { expect, test, type Page } from '@playwright/test'
import { grantAiConsent, registerUser } from './support/auth'
import { publishRareJob, saveRareProfile } from './support/admin'
import { jobAction, uniqueTitle } from './support/jobs'
import { PROFILE_A, SCORE_A, applyApi, newEmployer, publishScoredJob, setStatus } from './support/matching'
import { pngImage } from './support/images'
import { uploadPhotoApi } from './support/photo'
import { profileContent, saveProfileApi } from './support/profile'
import { fullResume } from './support/resume'

const banner = (page: Page) => page.getByRole('banner')
const numbers = (page: Page) => page.getByRole('region', { name: 'Your numbers' })
const recent = (page: Page) => page.getByRole('region', { name: 'Recent applications' })
const recs = (page: Page) => page.getByRole('region', { name: 'Recommended for you' })
const checklist = (page: Page) => page.getByRole('region', { name: 'Complete your profile' })
const bar = (page: Page) => page.getByRole('progressbar', { name: 'Profile completeness' })

/** Asserts one stat value; the lookbehind keeps "10" from matching "0". */
const expectStat = (page: Page, label: string, n: number) =>
  expect(numbers(page)).toContainText(new RegExp(`(?<!\\d)${n}\\s*${label}`))

test.describe('dashboard access', () => {
  test('sends anonymous visitors to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('tells an employer the dashboard is for candidates and hides the nav link', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    await page.goto('/dashboard')
    await expect(page.getByText('The dashboard is for candidate accounts.')).toBeVisible()
    await expect(banner(page).getByRole('link', { name: 'Dashboard', exact: true })).toHaveCount(0)
  })

  test('gives a candidate a Dashboard link that opens the page', async ({ page }) => {
    await registerUser(page.request, { role: 'candidate', name: 'Dana Dash' })
    await page.goto('/')
    await banner(page).getByRole('link', { name: 'Dashboard', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Welcome back, Dana' })).toBeVisible()
  })
})

test.describe('dashboard for a new candidate', () => {
  test('shows an empty checklist, zero stats and the build-your-resume prompt', async ({ page }) => {
    await registerUser(page.request, { role: 'candidate', name: 'Dana Dash' })
    const recommendationCalls: number[] = []
    page.on('response', (r) => {
      if (r.url().includes('/api/jobs/recommended')) recommendationCalls.push(r.status())
    })
    await page.goto('/dashboard')

    await expect(page.getByRole('heading', { name: 'Welcome back, Dana' })).toBeVisible()
    await expect(bar(page)).toHaveAttribute('aria-valuenow', '0')
    const items = checklist(page).getByRole('link')
    await expect(items.first()).toBeVisible()
    for (const link of await items.all()) await expect(link).toHaveAttribute('href', '/resume')
    await expect(checklist(page).getByRole('link', { name: 'Build and save your resume' })).toBeVisible()

    for (const label of ['Applications', 'In progress', 'Offers', 'Hired', 'Unread notifications']) {
      await expectStat(page, label, 0)
    }
    await expect(page.getByText('You have not applied to any jobs yet')).toBeVisible()
    await expect(recs(page).getByRole('link', { name: 'Build your resume' })).toBeVisible()
    await expect(page.getByRole('main').getByText('Could not load')).toHaveCount(0)
    expect(recommendationCalls).toEqual([])
  })
})

test.describe('dashboard profile progress', () => {
  test('raises the checklist percent after a resume is saved and offers a review', async ({ page }) => {
    await registerUser(page.request, { role: 'candidate' })
    // resume + headline + skills + roles = 4 of 10 items
    await saveProfileApi(page.request, profileContent())
    await page.goto('/dashboard')

    await expect(bar(page)).toHaveAttribute('aria-valuenow', '40')
    await expect(checklist(page).getByRole('link', { name: 'Build and save your resume' })).toHaveCount(0)
    await expect(checklist(page).getByRole('link', { name: 'Write a short summary' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Resume review' }).getByRole('link', { name: 'Review my resume' })).toBeVisible()
  })

  test('hides the checklist and shows the score once the profile is complete', async ({ page }) => {
    await registerUser(page.request, { role: 'candidate' })
    await saveProfileApi(page.request, fullResume(`dash${Date.now()}`))
    await uploadPhotoApi(page.request, pngImage())
    await grantAiConsent(page.request)
    const review = await page.request.post('/api/candidate/profile/evaluation')
    expect(review.ok(), await review.text()).toBe(true)

    await page.goto('/dashboard')
    const card = page.getByRole('region', { name: 'Resume review' })
    await expect(card).toContainText('/ 100')
    await expect(card.getByRole('link', { name: 'See the review' })).toBeVisible()
    await expect(checklist(page)).toHaveCount(0)
    await expect(bar(page)).toHaveCount(0)
  })
})

test.describe('dashboard applications', () => {
  test('counts an application through its stages and links the filtered list', async ({ page, playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishScoredJob(employer.ctx)
    await registerUser(page.request, { role: 'candidate' })
    await saveProfileApi(page.request, PROFILE_A)
    const application = await applyApi(page.request, job.id)

    await page.goto('/dashboard')
    await expectStat(page, 'Applications', 1)
    await expectStat(page, 'In progress', 1)
    await expectStat(page, 'Offers', 0)
    const row = recent(page)
    await expect(row.getByRole('link', { name: job.content.title })).toHaveAttribute('href', `/jobs/${job.id}`)
    await expect(row.getByText('Applied', { exact: true })).toBeVisible()
    await expect(row.getByLabel(`Match score ${SCORE_A} percent`)).toBeVisible()
    await expect(row.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/applications')

    expect((await setStatus(employer.ctx, application.id, 'offer')).status()).toBe(200)
    await page.goto('/dashboard')
    await expectStat(page, 'Offers', 1)
    await expectStat(page, 'In progress', 0)
    await expectStat(page, 'Unread notifications', 1)
    await expect(row.getByText('Offer', { exact: true })).toBeVisible()

    await numbers(page).getByRole('link', { name: /Offers/ }).click()
    await expect(page).toHaveURL(/\/applications\?status=offer/)
    await expect(page.getByRole('button', { name: 'Offer (1)', exact: true })).toHaveAttribute('aria-pressed', 'true')

    expect((await setStatus(employer.ctx, application.id, 'hired')).status()).toBe(200)
    await page.goto('/dashboard')
    await expectStat(page, 'Hired', 1)
    await expectStat(page, 'Offers', 0)
    await expectStat(page, 'Unread notifications', 2)
  })

  test('shows only the three newest applications and "View all" opens the full list', async ({ page, playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const prefix = uniqueTitle('Dashapp')
    const titles: string[] = []
    await registerUser(page.request, { role: 'candidate' })
    await saveProfileApi(page.request, PROFILE_A)
    for (let i = 1; i <= 4; i += 1) {
      const job = await publishScoredJob(employer.ctx, { title: `${prefix} n${i}` })
      titles.push(job.content.title)
      await applyApi(page.request, job.id)
    }

    await page.goto('/dashboard')
    await expectStat(page, 'Applications', 4)
    const links = recent(page).getByRole('link', { name: new RegExp(`^${prefix}`) })
    await expect(links).toHaveText([titles[3]!, titles[2]!, titles[1]!])

    await recent(page).getByRole('link', { name: 'View all' }).click()
    await expect(page).toHaveURL(/\/applications$/)
  })

  test('marks an application to a closed job and does not link it', async ({ page, playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishScoredJob(employer.ctx)
    await registerUser(page.request, { role: 'candidate' })
    await saveProfileApi(page.request, PROFILE_A)
    await applyApi(page.request, job.id)
    expect((await jobAction(employer.ctx, job.id, 'close')).status()).toBe(200)

    await page.goto('/dashboard')
    await expect(recent(page).getByText(job.content.title, { exact: true })).toBeVisible()
    await expect(recent(page)).toContainText('job closed')
    await expect(recent(page).getByRole('link', { name: job.content.title })).toHaveCount(0)
  })
})

test.describe('dashboard recommendations', () => {
  // The real ranking depends on every leftover job in the shared DB, so the UI is checked against a crafted response.
  const fakeJob = (n: number) => ({
    id: `fake-job-${n}`,
    employerName: 'Fake Co',
    company: null,
    title: `Crafted match ${n}`,
    skillIds: [],
    score: 90 - n,
    eligibility: { location: 'ok', workMode: 'ok', salary: 'ok' },
  })
  const stubRecommendations = (page: Page, jobs: unknown[]) =>
    page.route('**/api/jobs/recommended*', (route) => route.fulfill({ json: { jobs, termNames: {} } }))

  test('lists a recommended job with its score and links to it', async ({ page }) => {
    await registerUser(page.request, { role: 'candidate' })
    // The dashboard only asks for recommendations once a resume exists.
    await saveProfileApi(page.request, PROFILE_A)
    await stubRecommendations(page, [fakeJob(1)])

    await page.goto('/dashboard')
    await expect(recs(page).getByRole('link', { name: 'Crafted match 1' })).toHaveAttribute('href', '/jobs/fake-job-1')
    await expect(recs(page).getByLabel('Match score 89 percent')).toBeVisible()
  })

  test('shows at most three recommendations', async ({ page }) => {
    await registerUser(page.request, { role: 'candidate' })
    // The dashboard only asks for recommendations once a resume exists.
    await saveProfileApi(page.request, PROFILE_A)
    await stubRecommendations(page, [1, 2, 3, 4, 5].map(fakeJob))

    await page.goto('/dashboard')
    await expect(recs(page).getByLabel(/Match score \d+ percent/)).toHaveCount(3)
    await expect(recs(page).getByRole('link', { name: 'Crafted match 4' })).toHaveCount(0)
  })

  test('says there are no new matches when the list is empty', async ({ page }) => {
    await registerUser(page.request, { role: 'candidate' })
    // The dashboard only asks for recommendations once a resume exists.
    await saveProfileApi(page.request, PROFILE_A)
    await stubRecommendations(page, [])

    await page.goto('/dashboard')
    await expect(recs(page).getByText('No new matches right now')).toBeVisible()
  })

  test('loads recommendations from the real endpoint for a candidate with a resume', async ({ page, playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    await publishRareJob(employer.ctx)
    await registerUser(page.request, { role: 'candidate' })
    await saveRareProfile(page.request)

    const response = page.waitForResponse((r) => r.url().includes('/api/jobs/recommended'))
    await page.goto('/dashboard')
    expect((await response).status()).toBe(200)
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
    await expect(page.getByText('Could not load recommendations')).toHaveCount(0)
  })
})
