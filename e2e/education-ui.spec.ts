import { expect, test } from './support/fixtures'
import { registerUser } from './support/auth'
import { uniqueTitle } from './support/jobs'
import { pickTerm, profileContent, saveProfileApi, saveResume } from './support/profile'

test.describe('resume summary, role details and education', () => {
  test('saves them and keeps them after reload', async ({ page, currentUser }) => {
    void currentUser
    await page.goto('/resume')
    await expect(page.getByRole('heading', { name: 'Your resume' })).toBeVisible()

    await page.getByLabel('Summary', { exact: true }).fill('Backend engineer who likes payments.')
    await page.getByRole('button', { name: 'Add role' }).click()
    await page.getByLabel('Role title').fill('Payments developer')
    await page.getByLabel('Role years').fill('3')
    await page.getByLabel('Role company').fill('Acme Corp')
    await page.getByLabel('Role period').fill('Jan 2020 - Dec 2022')
    await page.getByLabel('Role description').fill('Built the card settlement pipeline.')

    await page.getByRole('button', { name: 'Add education' }).click()
    await page.getByLabel('Degree').selectOption({ label: 'Master' })
    await page.getByLabel('Field of study').fill('Computer Science')
    await page.getByLabel('Institution').fill('State University')
    await page.getByLabel('Education period').fill('2016 - 2018')
    await saveResume(page)

    await page.reload()
    await expect(page.getByLabel('Summary', { exact: true })).toHaveValue('Backend engineer who likes payments.')
    await expect(page.getByLabel('Role company')).toHaveValue('Acme Corp')
    await expect(page.getByLabel('Role period')).toHaveValue('Jan 2020 - Dec 2022')
    await expect(page.getByLabel('Role description')).toHaveValue('Built the card settlement pipeline.')
    await expect(page.getByLabel('Degree')).toHaveValue('3')
    await expect(page.getByLabel('Field of study')).toHaveValue('Computer Science')
    await expect(page.getByLabel('Institution')).toHaveValue('State University')
    await expect(page.getByLabel('Education period')).toHaveValue('2016 - 2018')

    await page.getByRole('button', { name: 'Remove education' }).click()
    await saveResume(page)
    await page.reload()
    await expect(page.getByLabel('Field of study')).toHaveCount(0)
    await expect(page.getByLabel('Summary', { exact: true })).toHaveValue('Backend engineer who likes payments.')
  })
})

test.describe('education requirement end to end', () => {
  test('flows from the job form to the match card and the employer applicant view', async ({ page, browser, baseURL }) => {
    // Employer posts a job that requires a master's degree, through the UI.
    const employerContext = await browser.newContext({ baseURL })
    const employer = await employerContext.newPage()
    await registerUser(employer.request, { role: 'employer' })
    const title = uniqueTitle('UI Education')

    await employer.goto('/employer/jobs/new')
    await employer.getByLabel('Title', { exact: true }).fill(title)
    await employer.getByLabel('Description').fill('Needs a graduate degree.')
    await pickTerm(employer, 'Search skills...', 'react', 'React')
    const degree = employer.getByLabel('Minimum education')
    await expect(degree.getByRole('option')).toHaveText([
      'Not required',
      'Diploma or associate',
      'Bachelor',
      'Master',
      'Doctorate',
    ])
    await degree.selectOption({ label: 'Master' })
    await employer.getByRole('button', { name: 'Create draft' }).click()
    await expect(employer).toHaveURL(/\/employer\/jobs$/)
    const row = employer.getByRole('listitem').filter({ hasText: title })
    await row.getByRole('button', { name: 'Publish' }).click()
    await expect(row).toContainText('Active')

    const jobs = (await (await employer.request.get('/api/employer/jobs')).json()).jobs as {
      id: string
      title: string
    }[]
    const job = jobs.find((j) => j.title === title)!
    const stored = (await (await employer.request.get(`/api/employer/jobs/${job.id}`)).json()).job
    expect(stored.content.minDegreeLevel).toBe(3)

    // The candidate has a bachelor's degree: 2/3 = 66bp -> education 67, shown in the match card.
    const candidate = await registerUser(page.request, { name: 'Edu Candidate' })
    await saveProfileApi(
      page.request,
      profileContent({
        summary: 'Summary visible to employers',
        skills: [{ termId: 'skill:react', level: 3, years: 2 }],
        roles: [
          {
            title: 'Frontend developer',
            years: 2,
            company: 'Widgets Inc',
            period: '2021 - 2023',
            description: 'Shipped the checkout redesign.',
          },
        ],
        education: [
          { degreeLevel: 2, field: 'Design', institution: 'Art School', period: '2015 - 2019' },
        ],
      }),
    )

    await page.goto(`/jobs/${job.id}`)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByText('Education: Master or above')).toBeVisible()
    await expect(page.getByTestId('live-score')).toBeVisible()
    const education = page.getByRole('progressbar', { name: 'Education' })
    await expect(education).toBeVisible()
    await expect(education).toHaveAttribute('aria-valuenow', '67')

    await page.getByRole('button', { name: 'Apply with your current resume' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Submit application' }).click()
    await expect(page.getByText(/You applied on/)).toBeVisible()

    // The candidate edits their resume afterwards; the employer still sees the applied version.
    await saveProfileApi(
      page.request,
      profileContent({
        summary: 'Edited later',
        skills: [{ termId: 'skill:react', level: 3, years: 2 }],
        roles: [{ title: 'Frontend developer', years: 2, description: 'Edited later' }],
        education: [{ degreeLevel: 4, field: 'Physics', institution: 'Other University' }],
      }),
    )

    await employer.goto(`/employer/jobs/${job.id}/applicants`)
    const applicant = employer.getByRole('listitem').filter({ hasText: candidate.email })
    await expect(applicant).toContainText('Edu Candidate')

    await applicant.getByText('Resume', { exact: true }).click()
    await expect(applicant.getByText('Summary visible to employers')).toBeVisible()
    await expect(applicant.getByText('Widgets Inc')).toBeVisible()
    await expect(applicant.getByText('Shipped the checkout redesign.')).toBeVisible()
    // The degree and the institution/period sit on two lines of the education entry.
    await expect(applicant.getByText('Bachelor · Design', { exact: true })).toBeVisible()
    await expect(applicant.getByText('Art School · 2015 - 2019', { exact: true })).toBeVisible()
    await expect(applicant.getByText('Edited later')).toHaveCount(0)
    await expect(applicant.getByText('Physics')).toHaveCount(0)

    await applicant.getByText('Score breakdown').click()
    const breakdown = applicant.getByRole('progressbar', { name: 'Education' })
    await expect(breakdown).toBeVisible()
    await expect(breakdown).toHaveAttribute('aria-valuenow', '67')

    await employerContext.close()
  })
})
