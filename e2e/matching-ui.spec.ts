import { expect, test, type Browser, type Page } from '@playwright/test'
import { registerUser } from './support/auth'
import { publishJobApi, uniqueTitle } from './support/jobs'
import { applyApi, getGap, PROFILE_A, PROFILE_B, publishReactJob, publishScoredJob, RARE_PROFILE_ROLES, rareMinYears, SCORE_A } from './support/matching'
import { saveProfileApi } from './support/profile'

/** Opens the apply confirmation and submits it. */
async function applyWithConfirmation(page: Page) {
  await page.getByRole('button', { name: 'Apply with your current resume' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Submit application' }).click()
}

test.describe('job match card', () => {
  test('shows the live score, breakdown and radar, then applies', async ({ page, browser, baseURL }) => {
    const employerContext = await browser.newContext({ baseURL })
    await registerUser(employerContext.request, { role: 'employer' })
    const title = uniqueTitle('UI Match')
    const job = await publishScoredJob(employerContext.request, { title })

    const candidate = await registerUser(page.request, { name: 'UI Candidate' })
    await saveProfileApi(page.request, PROFILE_A)

    await page.goto(`/jobs/${job.id}`)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByTestId('live-score')).toHaveText(`${SCORE_A}%`)
    await expect(page.getByRole('img', { name: /^Your match: Skills 67, Experience 60, Industry 100, Leadership 50, Certifications 50$/ })).toBeVisible()
    for (const name of ['Skills', 'Experience', 'Industry', 'Leadership', 'Certifications']) {
      await expect(page.getByRole('progressbar', { name })).toBeVisible()
    }
    await expect(page.getByRole('progressbar', { name: 'Skills' })).toHaveAttribute('aria-valuenow', '67')
    await expect(page.getByText('Required skills: React')).toBeVisible()
    await expect(page.getByText('Preferred skills: Python')).toBeVisible()
    await expect(page.getByText('Certifications: AWS Certified Solutions Architect')).toBeVisible()

    await applyWithConfirmation(page)
    await expect(page.getByText('Application sent')).toBeVisible()
    await expect(page.getByText(/You applied on/)).toBeVisible()
    await expect(page.getByText(`Your score when you applied: ${SCORE_A}%`)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Apply with your current resume' })).toHaveCount(0)

    // The candidate's list carries the frozen score.
    await page.goto('/applications')
    const row = page.getByRole('listitem').filter({ hasText: title })
    await expect(row.getByLabel(`Match score ${SCORE_A} percent`)).toBeVisible()
    await expect(row).toContainText('Applied')

    // The employer sees the candidate ranked and moves them through review.
    const employer = await employerContext.newPage()
    await employer.goto('/employer/jobs')
    await employer.getByRole('listitem').filter({ hasText: title }).getByRole('link', { name: 'Applicants' }).click()
    await expect(employer).toHaveURL(new RegExp(`/employer/jobs/${job.id}/applicants$`))

    const applicant = employer.getByRole('listitem').filter({ hasText: candidate.email })
    await expect(applicant).toContainText('#1')
    await expect(applicant).toContainText('UI Candidate')
    await expect(applicant.getByLabel(`Match score ${SCORE_A} percent`)).toBeVisible()

    await applicant.getByText('Score breakdown').click()
    await expect(applicant.getByRole('progressbar', { name: 'Skills' })).toBeVisible()
    await expect(applicant.getByText('Required skills: React')).toBeVisible()

    const stage = applicant.getByLabel('Move to stage')
    await stage.selectOption({ label: 'Under review' })
    await expect(applicant.getByRole('option', { name: 'Under review (current)' })).toBeAttached()
    await expect(applicant.getByText('Under review', { exact: true })).toBeVisible()
    await stage.selectOption({ label: 'Hired' })
    await employer.getByRole('alertdialog').getByRole('button', { name: 'Hire' }).click()
    await expect(applicant.getByText('Hired', { exact: true })).toBeVisible()
    await expect(applicant.getByLabel('Move to stage')).toHaveCount(0)

    // The candidate sees the new status, with the score unchanged.
    await page.goto('/applications')
    await expect(row).toContainText('Hired')
    await expect(row.getByLabel(`Match score ${SCORE_A} percent`)).toBeVisible()

    await employerContext.close()
  })

  test('keeps the applied score visible after the resume changes', async ({ page, browser, baseURL }) => {
    const employerContext = await browser.newContext({ baseURL })
    await registerUser(employerContext.request, { role: 'employer' })
    const job = await publishScoredJob(employerContext.request)

    await registerUser(page.request)
    await saveProfileApi(page.request, PROFILE_A)
    await page.goto(`/jobs/${job.id}`)
    await applyWithConfirmation(page)
    await expect(page.getByText(`Your score when you applied: ${SCORE_A}%`)).toBeVisible()

    await saveProfileApi(page.request, PROFILE_B)
    await page.reload()
    await expect(page.getByTestId('live-score')).not.toHaveText(`${SCORE_A}%`)
    await expect(page.getByText(`Your score when you applied: ${SCORE_A}%`)).toBeVisible()
    await employerContext.close()
  })

  test('shows a toast and no duplicate when applying fails because the job closed', async ({ page, browser, baseURL }) => {
    const employerContext = await browser.newContext({ baseURL })
    await registerUser(employerContext.request, { role: 'employer' })
    const job = await publishReactJob(employerContext.request, 3)

    await registerUser(page.request)
    await saveProfileApi(page.request, PROFILE_A)
    await page.goto(`/jobs/${job.id}`)
    await expect(page.getByTestId('live-score')).toBeVisible()

    const close = await employerContext.request.post(`/api/employer/jobs/${job.id}/close`)
    expect(close.status()).toBe(200)
    await applyWithConfirmation(page)
    await expect(page.getByText('Could not apply')).toBeVisible()
    await expect(page.getByText(/You applied on/)).toHaveCount(0)
    await employerContext.close()
  })
})

test.describe('apply confirmation', () => {
  const applyButton = (page: Page) => page.getByRole('button', { name: 'Apply with your current resume' })

  async function setup(page: Page, browser: Browser, baseURL: string | undefined) {
    const employerContext = await browser.newContext({ baseURL })
    await registerUser(employerContext.request, { role: 'employer' })
    const title = uniqueTitle('UI Confirm')
    const job = await publishScoredJob(employerContext.request, { title })
    await registerUser(page.request)
    await saveProfileApi(page.request, PROFILE_A)
    await page.goto(`/jobs/${job.id}`)
    await expect(page.getByTestId('live-score')).toHaveText(`${SCORE_A}%`)
    return { employerContext, job, title }
  }

  const applicationCount = async (page: Page) => {
    const res = await page.request.get('/api/candidate/applications')
    expect(res.status()).toBe(200)
    return ((await res.json()).applications as unknown[]).length
  }

  test('names the job and shows the live score before anything is sent', async ({ page, browser, baseURL }) => {
    const { employerContext, title } = await setup(page, browser, baseURL)

    await applyButton(page).click()
    const modal = page.getByRole('alertdialog', { name: `Apply to ${title}?` })
    await expect(modal).toBeVisible()
    await expect(modal).toContainText(`Your match score right now is ${SCORE_A}%`)
    await expect(modal).toContainText('cannot be withdrawn')
    await expect(modal.getByRole('button', { name: 'Cancel' })).toBeVisible()
    await expect(modal.getByRole('button', { name: 'Submit application' })).toBeVisible()
    expect(await applicationCount(page)).toBe(0)
    await employerContext.close()
  })

  test('Cancel sends nothing', async ({ page, browser, baseURL }) => {
    const { employerContext } = await setup(page, browser, baseURL)

    await applyButton(page).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(applyButton(page)).toBeVisible()
    await expect(page.getByText(/You applied on/)).toHaveCount(0)
    await expect(page.getByText('Application sent')).toHaveCount(0)
    expect(await applicationCount(page)).toBe(0)
    await employerContext.close()
  })

  test('Escape sends nothing', async ({ page, browser, baseURL }) => {
    const { employerContext } = await setup(page, browser, baseURL)

    await applyButton(page).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(applyButton(page)).toBeVisible()
    expect(await applicationCount(page)).toBe(0)
    await employerContext.close()
  })

  test('can cancel and then still apply from the same page', async ({ page, browser, baseURL }) => {
    const { employerContext } = await setup(page, browser, baseURL)

    await applyButton(page).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await applyWithConfirmation(page)
    await expect(page.getByText(/You applied on/)).toBeVisible()
    expect(await applicationCount(page)).toBe(1)
    await employerContext.close()
  })

  test('Submit applies exactly once and shows the applied status', async ({ page, browser, baseURL }) => {
    const { employerContext, job } = await setup(page, browser, baseURL)

    await applyWithConfirmation(page)
    await expect(page.getByText('Application sent')).toBeVisible()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.getByText(/You applied on/)).toBeVisible()
    await expect(page.getByText(`Your score when you applied: ${SCORE_A}%`)).toBeVisible()
    await expect(applyButton(page)).toHaveCount(0)
    expect(await applicationCount(page)).toBe(1)
    expect((await getGap(page.request, job.id)).application?.matchScore).toBe(SCORE_A)
    await employerContext.close()
  })

  test('a candidate who already applied sees no Apply button', async ({ page, browser, baseURL }) => {
    const employerContext = await browser.newContext({ baseURL })
    await registerUser(employerContext.request, { role: 'employer' })
    const job = await publishScoredJob(employerContext.request)
    await registerUser(page.request)
    await saveProfileApi(page.request, PROFILE_A)
    await applyApi(page.request, job.id)

    await page.goto(`/jobs/${job.id}`)
    await expect(page.getByText(/You applied on/)).toBeVisible()
    await expect(applyButton(page)).toHaveCount(0)
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await employerContext.close()
  })

  test('applying to a job that closed meanwhile shows an error and closes the modal', async ({ page, browser, baseURL }) => {
    const { employerContext, job } = await setup(page, browser, baseURL)

    await applyButton(page).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    const close = await employerContext.request.post(`/api/employer/jobs/${job.id}/close`)
    expect(close.status()).toBe(200)
    await page.getByRole('alertdialog').getByRole('button', { name: 'Submit application' }).click()
    await expect(page.getByText('Could not apply')).toBeVisible()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.getByText(/You applied on/)).toHaveCount(0)
    expect(await applicationCount(page)).toBe(0)
    await employerContext.close()
  })
})

test.describe('match card for other visitors', () => {
  test('prompts a candidate without a resume to build one', async ({ page, browser, baseURL }) => {
    const employerContext = await browser.newContext({ baseURL })
    await registerUser(employerContext.request, { role: 'employer' })
    const job = await publishReactJob(employerContext.request)
    await registerUser(page.request)

    await page.goto(`/jobs/${job.id}`)
    await expect(page.getByText('Build your resume to see how you match')).toBeVisible()
    await page.getByRole('link', { name: 'Go to your resume' }).click()
    await expect(page).toHaveURL(/\/resume$/)

    await page.goto('/jobs')
    await page.getByRole('button', { name: /Recommended for you/ }).click()
    await expect(page.getByRole('link', { name: 'Build your resume' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Recommended for you' })).toHaveCount(0)
    await employerContext.close()
  })

  test('asks an anonymous visitor to log in', async ({ page, browser, baseURL }) => {
    const employerContext = await browser.newContext({ baseURL })
    await registerUser(employerContext.request, { role: 'employer' })
    const job = await publishReactJob(employerContext.request)

    await page.goto(`/jobs/${job.id}`)
    await expect(page.getByText(/as a candidate to see your match score and apply/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Log in' }).first()).toBeVisible()
    await expect(page.getByTestId('live-score')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Apply with your current resume' })).toHaveCount(0)
    await employerContext.close()
  })

  test('shows employers no match card', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishReactJob(page.request)

    await page.goto(`/jobs/${job.id}`)
    await expect(page.getByRole('heading', { name: job.content.title })).toBeVisible()
    await expect(page.getByText('How you match')).toHaveCount(0)
    await expect(page.getByTestId('live-score')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Apply with your current resume' })).toHaveCount(0)
  })
})

test.describe('recommended jobs on /jobs', () => {
  test('lists recommended jobs with their match score', async ({ page, browser, baseURL }) => {
    const employerContext = await browser.newContext({ baseURL })
    await registerUser(employerContext.request, { role: 'employer' })
    const title = uniqueTitle('UI Rec')
    // A skill used only here plus a random experience requirement keep the job in the top 10 of the shared pool.
    const job = await publishJobApi(employerContext.request, {
      title,
      skills: [{ termId: 'skill:mongodb', required: true, minLevel: 4 }],
      minYears: rareMinYears(),
    })

    await registerUser(page.request)
    await saveProfileApi(page.request, {
      ...PROFILE_A,
      skills: [{ termId: 'skill:mongodb', level: 2, years: 1 }],
      roles: RARE_PROFILE_ROLES,
    })
    const score = (await getGap(page.request, job.id)).score

    await page.goto('/jobs')
    await page.getByRole('button', { name: /Recommended for you/ }).click()
    const section =page.getByRole('region', { name: 'Recommended for you' })
    await expect(section).toBeVisible()
    const item = section.getByRole('listitem').filter({ hasText: title })
    await expect(item.getByLabel(`Match score ${score} percent`)).toBeVisible()
    await item.getByRole('link', { name: new RegExp(title) }).click()
    await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]+$/)
    await expect(page.getByTestId('live-score')).toHaveText(`${score}%`)
    await employerContext.close()
  })

  test('links the employer job list to its applicants page', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishReactJob(page.request)
    await page.goto('/employer/jobs')
    await page.getByRole('listitem').filter({ hasText: job.content.title }).getByRole('link', { name: 'Applicants' }).click()
    await expect(page).toHaveURL(new RegExp(`/employer/jobs/${job.id}/applicants$`))
    await expect(page.getByText('No applications yet.')).toBeVisible()
  })
})

test.describe('applications page', () => {
  test('shows an empty state with a link to browse jobs', async ({ page }) => {
    await registerUser(page.request)
    await page.goto('/applications')
    await expect(page.getByText('You have not applied to any jobs yet.')).toBeVisible()
    await page.getByRole('link', { name: 'Browse jobs' }).click()
    await expect(page).toHaveURL(/\/jobs$/)
  })

  test('is reachable from the navbar for candidates', async ({ page }) => {
    await registerUser(page.request)
    await page.goto('/')
    await page.getByRole('link', { name: 'Applications' }).first().click()
    await expect(page).toHaveURL(/\/applications$/)
  })

  test('shows the candidate-only message to employers', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    await page.goto('/applications')
    await expect(page.getByText('Applications are for candidate accounts.')).toBeVisible()
  })

  test('redirects anonymous visitors to /login', async ({ page }) => {
    await page.goto('/applications')
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe('applicants page access', () => {
  test('redirects anonymous visitors to /login', async ({ page }) => {
    await page.goto('/employer/jobs/00000000-0000-4000-8000-000000000000/applicants')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('tells candidates the page is for employers', async ({ page }) => {
    await registerUser(page.request)
    await page.goto('/employer/jobs/00000000-0000-4000-8000-000000000000/applicants')
    await expect(page.getByText('Applicants are for employer accounts.')).toBeVisible()
  })

  test('shows not-found for a job the employer does not own', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    await page.goto('/employer/jobs/00000000-0000-4000-8000-000000000000/applicants')
    await expect(page.getByText('That job was not found.')).toBeVisible()
  })
})
