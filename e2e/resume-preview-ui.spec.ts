import { expect, test } from '@playwright/test'
import { registerUser, uniqueEmail } from './support/auth'
import { MISSING_ID } from './support/matching'
import { EMPTY_CONTACT, listVersionsApi, profileContent, saveProfileApi } from './support/profile'
import { CONTACT, PRIVATE, fullResume } from './support/resume'

let counter = 0
const uniqueToken = () => `T${Date.now().toString(36)}${(counter += 1)}`

test.describe('resume preview access', () => {
  test('redirects anonymous visitors to /login', async ({ page }) => {
    await page.goto('/resume/preview')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('shows the candidate-only message to employers', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    await page.goto('/resume/preview')
    await expect(page.getByText('The resume preview is for candidate accounts.')).toBeVisible()
    await expect(page.getByRole('article', { name: 'Resume' })).toHaveCount(0)
  })

  test('prompts a candidate without a saved resume to build one', async ({ page }) => {
    await registerUser(page.request)
    await page.goto('/resume/preview')
    await expect(page.getByText('You have not saved a resume yet.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Build your resume' })).toHaveAttribute('href', '/resume')
    await expect(page.getByRole('button', { name: 'Download PDF' })).toHaveCount(0)
  })

  test('is reachable from the editor and keeps working after a reload on ?version=', async ({ page }) => {
    await registerUser(page.request)
    const token = uniqueToken()
    const a = await saveProfileApi(page.request, profileContent({ headline: `Older ${token}` }))
    await saveProfileApi(page.request, profileContent({ headline: `Newer ${token}` }))

    await page.goto('/resume')
    await page.getByRole('link', { name: 'Preview & download' }).click()
    await expect(page).toHaveURL(/\/resume\/preview$/)
    await expect(page.getByRole('article', { name: 'Resume' })).toContainText(`Newer ${token}`)

    await page.goto(`/resume/preview?version=${a.id}`)
    await page.reload()
    await expect(page).toHaveURL(`/resume/preview?version=${a.id}`)
    await expect(page.getByRole('article', { name: 'Resume' })).toContainText(`Older ${token}`)
    await expect(page.getByLabel('Version', { exact: true })).toHaveValue(a.id)
  })
})

test.describe('resume preview content', () => {
  test('shows every section with the entered content and keeps role and education order', async ({ page }) => {
    const token = uniqueToken()
    const user = await registerUser(page.request, { name: `Preview Person ${token}` })
    await saveProfileApi(page.request, fullResume(token))

    await page.goto('/resume/preview')
    const sheet = page.getByRole('article', { name: 'Resume' })
    await expect(sheet).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Resume preview' })).toBeVisible()

    // Header
    await expect(sheet.getByRole('heading', { level: 1, name: user.name })).toBeVisible()
    await expect(sheet.getByText(`Platform engineer ${token}`)).toBeVisible()
    await expect(sheet.getByText('resume.contact@example.com · +1 555 010 4242 · Toronto, Canada', { exact: true })).toBeVisible()

    // Section headings, in order
    for (const heading of ['Summary', 'Skills', 'Experience', 'Education', 'Certifications', 'Additional']) {
      await expect(sheet.getByRole('heading', { level: 2, name: heading, exact: true })).toBeVisible()
    }
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText([
      'Summary',
      'Skills',
      'Experience',
      'Education',
      'Certifications',
      'Additional',
    ])

    await expect(sheet.getByText(`Summary line for ${token}.`)).toBeVisible()

    // Highest level first, then alphabetical; "yr" is singular for 1
    await expect(
      sheet.getByText('Python (Expert, 6 yrs) · React (Intermediate, 2 yrs) · TypeScript (Intermediate, 1 yr)', {
        exact: true,
      }),
    ).toBeVisible()

    // Experience in entered order (not alphabetical, not by years)
    await expect(sheet.getByText(`Zeta Lead ${token}, Zeta Corp`, { exact: true })).toBeVisible()
    await expect(sheet.getByText('Jan 2022 - Mar 2024')).toBeVisible()
    await expect(sheet.getByText('Fintech', { exact: true })).toBeVisible()
    await expect(sheet.getByText(`Led the zeta platform ${token}`)).toBeVisible()
    await expect(sheet.getByText(`Alpha Developer ${token}, Alpha Inc`, { exact: true })).toBeVisible()
    // No company: title only. No period: falls back to years.
    await expect(sheet.getByText(`Mid Analyst ${token}`, { exact: true })).toBeVisible()
    await expect(sheet.getByText('1 yr', { exact: true })).toBeVisible()
    const text = (await sheet.textContent()) ?? ''
    const positions = [`Zeta Lead ${token}`, `Alpha Developer ${token}`, `Mid Analyst ${token}`].map((t) => text.indexOf(t))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((x, y) => x - y))

    // Education in entered order
    await expect(sheet.getByText('Master, Artificial Intelligence', { exact: true })).toBeVisible()
    await expect(sheet.getByText('Tech Institute', { exact: true })).toBeVisible()
    await expect(sheet.getByText('Bachelor, Computer Science', { exact: true })).toBeVisible()
    await expect(sheet.getByText('State University', { exact: true })).toBeVisible()
    expect(text.indexOf('Master, Artificial Intelligence')).toBeLessThan(text.indexOf('Bachelor, Computer Science'))

    // Certifications alphabetical
    await expect(sheet.getByRole('listitem').filter({ hasText: /^AWS Certified/ })).toHaveText([
      'AWS Certified Developer',
      'AWS Certified Solutions Architect',
    ])

    // Additional
    await expect(sheet.getByText('Leadership: Manager', { exact: true })).toBeVisible()
    await expect(sheet.getByText('Other skills: Bash scripting, Kanban', { exact: true })).toBeVisible()
  })

  test('never shows job preferences anywhere on the page', async ({ page }) => {
    const token = uniqueToken()
    await registerUser(page.request, { name: `Private Person ${token}` })
    await saveProfileApi(page.request, fullResume(token))

    await page.goto('/resume/preview')
    await expect(page.getByRole('article', { name: 'Resume' })).toContainText(`Platform engineer ${token}`)
    const body = page.locator('body')
    await expect(body).not.toContainText(PRIVATE.location)
    await expect(body).not.toContainText(String(PRIVATE.minSalary))
    await expect(body).not.toContainText('987,654')
    await expect(body).not.toContainText(PRIVATE.workMode, { ignoreCase: true })
  })

  test('renders links as new-tab anchors and falls back to the account email', async ({ page }) => {
    const token = uniqueToken()
    const user = await registerUser(page.request, { name: `Links Person ${token}` })
    // No contact email: the account email is used instead.
    await saveProfileApi(
      page.request,
      profileContent({ headline: `Links ${token}`, contact: { ...CONTACT, email: '' } }),
    )

    await page.goto('/resume/preview')
    const sheet = page.getByRole('article', { name: 'Resume' })
    await expect(sheet.getByText(`${user.email} · +1 555 010 4242 · Toronto, Canada`, { exact: true })).toBeVisible()
    await expect(sheet.getByText('resume.contact@example.com')).toHaveCount(0)

    const expected = [
      { label: 'LinkedIn', url: CONTACT.linkedin! },
      { label: 'GitHub', url: CONTACT.github! },
      { label: 'Website', url: CONTACT.website! },
      { label: 'Other', url: CONTACT.other! },
    ]
    for (const { label, url } of expected) {
      await expect(sheet.getByText(`${label}:`)).toBeVisible()
      const link = sheet.getByRole('link', { name: url, exact: true })
      await expect(link).toHaveAttribute('href', url)
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', /noopener/)
      await expect(link).toHaveAttribute('rel', /noreferrer/)
    }
  })

  test('omits empty sections and shows only what exists', async ({ page }) => {
    const token = uniqueToken()
    const user = await registerUser(page.request, { name: `Minimal Person ${token}` })
    await saveProfileApi(
      page.request,
      profileContent({ headline: `Minimal ${token}`, skills: [], roles: [], contact: EMPTY_CONTACT }),
    )

    await page.goto('/resume/preview')
    const sheet = page.getByRole('article', { name: 'Resume' })
    await expect(sheet.getByRole('heading', { level: 1, name: user.name })).toBeVisible()
    await expect(sheet.getByText(`Minimal ${token}`)).toBeVisible()
    await expect(sheet.getByText(user.email, { exact: true })).toBeVisible()
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveCount(0)
    await expect(sheet.getByRole('link')).toHaveCount(0)
    // A single version: no version picker
    await expect(page.getByLabel('Version', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Back to editor' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveAttribute('href', '/resume')
  })

  test('shows only the sections that have content', async ({ page }) => {
    const token = uniqueToken()
    await registerUser(page.request, { name: `Partial Person ${token}` })
    await saveProfileApi(
      page.request,
      profileContent({ headline: `Partial ${token}`, summary: 'Only a summary and a skill.', roles: [], leadershipLevel: 0 }),
    )
    await page.goto('/resume/preview')
    await expect(page.getByRole('article', { name: 'Resume' }).getByRole('heading', { level: 2 })).toHaveText([
      'Summary',
      'Skills',
    ])
  })
})

test.describe('resume preview versions', () => {
  test('defaults to the current version and switches between versions with the picker', async ({ page }) => {
    const token = uniqueToken()
    const user = await registerUser(page.request, { name: `Versions Person ${token}` })
    const a = await saveProfileApi(
      page.request,
      profileContent({
        headline: `Headline A ${token}`,
        roles: [{ title: `Role A ${token}`, years: 1 }],
        contact: { ...EMPTY_CONTACT, phone: '+1 555 000 1111', city: 'OldTown', country: 'Oldland' },
      }),
    )
    const b = await saveProfileApi(
      page.request,
      profileContent({
        headline: `Headline B ${token}`,
        roles: [{ title: `Role B ${token}`, years: 2 }],
        contact: { ...EMPTY_CONTACT, phone: '+44 20 7946 0000', city: 'London', country: 'UK' },
      }),
    )
    expect(b.id).not.toBe(a.id)

    await page.goto('/resume/preview')
    const sheet = page.getByRole('article', { name: 'Resume' })
    const picker = page.getByLabel('Version', { exact: true })
    await expect(sheet.getByText(`Headline B ${token}`)).toBeVisible()
    await expect(picker).toHaveValue(b.id)
    await expect(picker.getByRole('option')).toHaveCount(2)
    await expect(picker.getByRole('option', { name: /\(current\)$/ })).toHaveCount(1)
    await expect(picker.getByRole('option', { name: /\(current\)$/ })).toHaveAttribute('value', b.id)
    await expect(page.getByRole('status').filter({ hasText: 'You are viewing the version saved on' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveAttribute('href', '/resume')
    await expect(page.getByRole('link', { name: 'Back to editor' })).toHaveCount(0)
    await expect(sheet.getByText(`${user.email} · +44 20 7946 0000 · London, UK`, { exact: true })).toBeVisible()

    // Older version
    await picker.selectOption(a.id)
    await expect(page).toHaveURL(`/resume/preview?version=${a.id}`)
    await expect(sheet.getByText(`Headline A ${token}`)).toBeVisible()
    await expect(sheet.getByText(`Role A ${token}`)).toBeVisible()
    await expect(sheet.getByText(`Headline B ${token}`)).toHaveCount(0)
    await expect(sheet.getByText(`Role B ${token}`)).toHaveCount(0)
    await expect(
      page.getByRole('status').filter({ hasText: /You are viewing the version saved on .* Your contact details always show your latest information/ }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Edit a copy of this version' })).toHaveAttribute(
      'href',
      `/resume?from=${a.id}`,
    )
    await expect(page.getByRole('link', { name: 'Back to editor' })).toHaveAttribute('href', '/resume')
    await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0)
    // Contact comes from the current record, not from when A was saved
    await expect(sheet.getByText(`${user.email} · +44 20 7946 0000 · London, UK`, { exact: true })).toBeVisible()
    await expect(sheet.getByText('OldTown')).toHaveCount(0)

    // Back to the current version
    await picker.selectOption(b.id)
    await expect(page).toHaveURL(/\/resume\/preview$/)
    await expect(sheet.getByText(`Headline B ${token}`)).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'You are viewing the version saved on' })).toHaveCount(0)
  })

  test('the history panel View links open the matching version', async ({ page }) => {
    const token = uniqueToken()
    await registerUser(page.request, { name: `History Person ${token}` })
    const a = await saveProfileApi(page.request, profileContent({ headline: `History A ${token}` }))
    const b = await saveProfileApi(page.request, profileContent({ headline: `History B ${token}` }))

    await page.goto('/resume')
    const views = page.getByRole('link', { name: /^View version from / })
    await expect(views).toHaveCount(2)

    // Newest first: the current version links to the plain preview, the older one carries its id.
    await expect(views.nth(0)).toHaveAttribute('href', '/resume/preview')
    await expect(views.nth(1)).toHaveAttribute('href', `/resume/preview?version=${a.id}`)

    await views.nth(1).click()
    await expect(page).toHaveURL(`/resume/preview?version=${a.id}`)
    await expect(page.getByRole('article', { name: 'Resume' })).toContainText(`History A ${token}`)

    await page.goBack()
    await page.getByRole('link', { name: /^View version from / }).first().click()
    await expect(page).toHaveURL(/\/resume\/preview$/)
    await expect(page.getByRole('article', { name: 'Resume' })).toContainText(`History B ${token}`)
    expect(b.id).not.toBe(a.id)
  })

  test('says the version was not found for an unknown id', async ({ page }) => {
    await registerUser(page.request)
    await saveProfileApi(page.request, profileContent())
    await page.goto(`/resume/preview?version=${MISSING_ID}`)
    await expect(page.getByText('That version was not found.')).toBeVisible()
    await expect(page.getByRole('article', { name: 'Resume' })).toHaveCount(0)
    await page.getByRole('link', { name: 'View your current resume' }).click()
    await expect(page).toHaveURL(/\/resume\/preview$/)
    await expect(page.getByRole('article', { name: 'Resume' })).toBeVisible()
  })

  test("does not show another candidate's version", async ({ page, playwright, baseURL }) => {
    const other = await playwright.request.newContext({ baseURL })
    await registerUser(other)
    const foreign = await saveProfileApi(other, profileContent({ headline: 'Foreign secret headline' }))
    expect(await listVersionsApi(other)).toHaveLength(1)
    await other.dispose()

    await registerUser(page.request, { email: uniqueEmail('mine') })
    await saveProfileApi(page.request, profileContent({ headline: 'My own headline' }))
    await page.goto(`/resume/preview?version=${foreign.id}`)
    await expect(page.getByText('That version was not found.')).toBeVisible()
    await expect(page.getByText('Foreign secret headline')).toHaveCount(0)
  })
})
