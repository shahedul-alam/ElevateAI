import { expect, test } from './support/fixtures'
import { registerUser } from './support/auth'
import { applyApi, publishReactJob } from './support/matching'
import { getProfileApi, listVersionsApi, pickTerm, saveProfileApi, saveResume, profileContent } from './support/profile'

const LINKS = {
  linkedin: 'https://www.linkedin.com/in/ui-person',
  github: 'https://github.com/ui-person',
  website: 'https://ui-person.example.com/work',
  other: 'http://example.org/ui-other',
}

test.describe('contact details on the resume page', () => {
  test('shows the card first with its helper text and the account email as placeholder', async ({
    page,
    currentUser,
  }) => {
    await page.goto('/resume')
    await expect(page.getByRole('heading', { name: 'Your resume' })).toBeVisible()
    await expect(page.getByText('Contact details', { exact: true })).toBeVisible()
    await expect(page.getByText('Leave empty to use your account email.')).toBeVisible()
    await expect(page.getByLabel('Contact email')).toHaveAttribute('placeholder', currentUser.email)
    await expect(page.getByText(/not versioned/)).toBeVisible()
  })

  test('saves every contact field and keeps them after reload', async ({ page, currentUser }) => {
    void currentUser
    await page.goto('/resume')
    await expect(page.getByRole('heading', { name: 'Your resume' })).toBeVisible()

    await page.getByLabel('Phone').fill('+1 (555) 010-0123')
    await page.getByLabel('Contact email').fill('contact.me@example.com')
    await page.getByLabel('City').fill('Toronto')
    await page.getByLabel('Country').fill('Canada')
    await page.getByLabel('LinkedIn').fill(LINKS.linkedin)
    await page.getByLabel('GitHub').fill(LINKS.github)
    await page.getByLabel('Website or portfolio').fill(LINKS.website)
    await page.getByLabel('Other link').fill(LINKS.other)
    await saveResume(page)

    await page.reload()
    await expect(page.getByLabel('Phone')).toHaveValue('+1 (555) 010-0123')
    await expect(page.getByLabel('Contact email')).toHaveValue('contact.me@example.com')
    await expect(page.getByLabel('City')).toHaveValue('Toronto')
    await expect(page.getByLabel('Country')).toHaveValue('Canada')
    await expect(page.getByLabel('LinkedIn')).toHaveValue(LINKS.linkedin)
    await expect(page.getByLabel('GitHub')).toHaveValue(LINKS.github)
    await expect(page.getByLabel('Website or portfolio')).toHaveValue(LINKS.website)
    await expect(page.getByLabel('Other link')).toHaveValue(LINKS.other)

    const stored = await getProfileApi(page.request)
    expect(stored.contact).toMatchObject({ phone: '+1 (555) 010-0123', email: 'contact.me@example.com', city: 'Toronto' })
  })

  const invalid = [
    { label: 'Phone', value: 'not a phone', error: 'Enter a valid phone number' },
    { label: 'Contact email', value: 'not-an-email', error: 'Enter a valid email address' },
    { label: 'LinkedIn', value: 'linkedin.com/in/me', error: 'Enter a full link starting with https://' },
    { label: 'GitHub', value: 'javascript:alert(1)', error: 'Enter a full link starting with https://' },
    { label: 'Website or portfolio', value: 'ftp://example.com', error: 'Enter a full link starting with https://' },
    { label: 'Other link', value: 'example.com', error: 'Enter a full link starting with https://' },
  ]

  for (const c of invalid) {
    test(`blocks saving an invalid ${c.label} with an inline error`, async ({ page, currentUser }) => {
      void currentUser
      const saves: string[] = []
      page.on('request', (r) => {
        if (r.url().endsWith('/api/candidate/profile') && r.method() === 'PUT') saves.push(r.url())
      })
      await page.goto('/resume')
      await expect(page.getByRole('heading', { name: 'Your resume' })).toBeVisible()

      await page.getByLabel(c.label).fill(c.value)
      await page.getByRole('button', { name: 'Save resume' }).click()

      await expect(page.getByText(c.error)).toBeVisible()
      await expect(page.getByLabel(c.label)).toHaveAttribute('aria-invalid', 'true')
      expect(saves).toEqual([])
      expect(await listVersionsApi(page.request)).toEqual([])
    })
  }

  test('saves once the invalid value is fixed', async ({ page, currentUser }) => {
    void currentUser
    await page.goto('/resume')
    await page.getByLabel('Phone').fill('abc')
    await page.getByRole('button', { name: 'Save resume' }).click()
    await expect(page.getByText('Enter a valid phone number')).toBeVisible()

    await page.getByLabel('Phone').fill('555 0100')
    await saveResume(page)
    await expect(page.getByText('Enter a valid phone number')).toHaveCount(0)
    expect((await getProfileApi(page.request)).contact.phone).toBe('555 0100')
  })

  test('leaves contact details unchanged when an older version is restored', async ({ page, currentUser }) => {
    void currentUser
    await page.goto('/resume')
    await expect(page.getByRole('heading', { name: 'Your resume' })).toBeVisible()

    await page.getByLabel('Short professional headline').fill('Version A')
    await pickTerm(page, 'Search skills...', 'react', 'React')
    await page.getByLabel('Phone').fill('111 111 1111')
    await page.getByLabel('City').fill('Oldtown')
    await saveResume(page)

    await page.getByLabel('Short professional headline').fill('Version B')
    await page.getByLabel('Phone').fill('222 222 2222')
    await page.getByLabel('City').fill('Newtown')
    await saveResume(page)
    expect(await listVersionsApi(page.request)).toHaveLength(2)

    await page.getByRole('button', { name: 'Restore' }).click()
    await expect(page.getByLabel('Short professional headline')).toHaveValue('Version A')
    await expect(page.getByLabel('Phone')).toHaveValue('222 222 2222')
    await expect(page.getByLabel('City')).toHaveValue('Newtown')

    const stored = await getProfileApi(page.request)
    expect(stored.contact).toMatchObject({ phone: '222 222 2222', city: 'Newtown' })
    expect(await listVersionsApi(page.request)).toHaveLength(2)
  })

  test('a contact-only change saves without adding a resume version', async ({ page, currentUser }) => {
    void currentUser
    await saveProfileApi(page.request, profileContent({ headline: 'Stable resume' }))
    await page.goto('/resume')
    await expect(page.getByLabel('Short professional headline')).toHaveValue('Stable resume')

    await page.getByLabel('Phone').fill('333 333 3333')
    await saveResume(page)
    expect(await listVersionsApi(page.request)).toHaveLength(1)
    expect((await getProfileApi(page.request)).contact.phone).toBe('333 333 3333')
  })
})

test.describe('contact details on the employer applicants page', () => {
  test('shows phone, location and safe external links to the employer', async ({
    page,
    browser,
    baseURL,
    currentUser,
  }) => {
    void currentUser

    const employerContext = await browser.newContext({ baseURL })
    const employerPage = await employerContext.newPage()
    await registerUser(employerPage.request, { role: 'employer' })
    const job = await publishReactJob(employerPage.request, 3)

    // Candidate sets contact through the UI, then applies.
    await saveProfileApi(page.request, profileContent({ skills: [{ termId: 'skill:react', level: 3, years: 2 }] }))
    await page.goto('/resume')
    await expect(page.getByRole('heading', { name: 'Your resume' })).toBeVisible()
    await page.getByLabel('Phone').fill('+1 555 010 4242')
    await page.getByLabel('City').fill('Austin')
    await page.getByLabel('Country').fill('USA')
    await page.getByLabel('LinkedIn').fill(LINKS.linkedin)
    await page.getByLabel('GitHub').fill(LINKS.github)
    await page.getByLabel('Website or portfolio').fill(LINKS.website)
    await page.getByLabel('Other link').fill(LINKS.other)
    await saveResume(page)
    await applyApi(page.request, job.id)

    await employerPage.goto(`/employer/jobs/${job.id}/applicants`)
    const applicant = employerPage.getByRole('listitem').filter({ hasText: currentUser.email })
    await expect(applicant.getByText('Phone: +1 555 010 4242')).toBeVisible()
    await expect(applicant.getByText('Austin, USA')).toBeVisible()

    const expected = [
      ['LinkedIn', LINKS.linkedin],
      ['GitHub', LINKS.github],
      ['Website', LINKS.website],
      ['Other', LINKS.other],
    ] as const
    for (const [label, href] of expected) {
      const link = applicant.getByRole('link', { name: label, exact: true })
      await expect(link).toHaveAttribute('href', href)
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', /noopener/)
      await expect(link).toHaveAttribute('rel', /noreferrer/)
    }

    // The candidate changes contact afterwards; the employer sees the new details after a reload.
    await page.getByLabel('Phone').fill('+1 555 010 9999')
    await page.getByLabel('LinkedIn').fill('')
    await saveResume(page)
    await employerPage.reload()
    await expect(applicant.getByText('Phone: +1 555 010 9999')).toBeVisible()
    await expect(applicant.getByRole('link', { name: 'LinkedIn', exact: true })).toHaveCount(0)
    await expect(applicant.getByRole('link', { name: 'GitHub', exact: true })).toBeVisible()

    await employerContext.close()
  })

  test('shows the contact email and no phone, location or links when none are set', async ({
    page,
    browser,
    baseURL,
    currentUser,
  }) => {
    void currentUser
    const employerContext = await browser.newContext({ baseURL })
    const employerPage = await employerContext.newPage()
    await registerUser(employerPage.request, { role: 'employer' })
    const job = await publishReactJob(employerPage.request, 3)

    await saveProfileApi(page.request, profileContent({ skills: [{ termId: 'skill:react', level: 3, years: 2 }] }))
    await applyApi(page.request, job.id)

    await employerPage.goto(`/employer/jobs/${job.id}/applicants`)
    const applicant = employerPage.getByRole('listitem').filter({ hasText: currentUser.email })
    await expect(applicant).toBeVisible()
    await expect(applicant).toContainText(currentUser.email)
    await expect(applicant.getByText(/Phone:/)).toHaveCount(0)
    await expect(applicant.getByRole('link')).toHaveCount(0)

    await employerContext.close()
  })
})
