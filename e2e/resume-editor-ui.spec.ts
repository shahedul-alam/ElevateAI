import { expect, test, type Locator } from '@playwright/test'
import { registerUser } from './support/auth'
import { newSignedInContext } from './support/jobs'
import { MISSING_ID, getGap, publishReactJob } from './support/matching'
import { getProfileApi, listVersionsApi, profileContent, saveProfileApi, saveResume } from './support/profile'
import { downloadPdf, expectInOrder, fullResume, pdfText } from './support/resume'

let counter = 0
const uniqueToken = () => `E${Date.now().toString(36)}${(counter += 1)}`

/** The current values of a group of inputs, in page order. */
const valuesOf = (locator: Locator) => locator.evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))

test.describe('reordering roles and education', () => {
  test('moves entries, creates a new version, keeps the score, and reuses versions for a known order', async ({
    page,
    playwright,
    baseURL,
  }) => {
    const token = uniqueToken()
    const employer = await newSignedInContext(playwright, baseURL)
    const job = await publishReactJob(employer, 4)
    await employer.dispose()

    await registerUser(page.request, { name: 'Reorder Person' })
    const original = await saveProfileApi(page.request, fullResume(token))
    const gapBefore = await getGap(page.request, job.id)
    const roleTitles = [`Zeta Lead ${token}`, `Alpha Developer ${token}`, `Mid Analyst ${token}`]
    const fields = ['Artificial Intelligence', 'Computer Science']

    await page.goto('/resume')
    const titles = page.getByLabel('Role title')
    const eduFields = page.getByLabel('Field of study')
    await expect(titles).toHaveCount(3)
    expect(await valuesOf(titles)).toEqual(roleTitles)
    expect(await valuesOf(eduFields)).toEqual(fields)
    await expect(page.getByText('The preview shows your last saved resume.')).toHaveCount(0)
    await expect(page.getByText(/use the arrows to rearrange them/)).toBeVisible()
    await expect(page.getByText(/Use the arrows to set the order they appear in/)).toBeVisible()

    // First "up" and last "down" are disabled; the rest are enabled
    const roleUp = page.getByRole('button', { name: 'Move role up' })
    const roleDown = page.getByRole('button', { name: 'Move role down' })
    const eduUp = page.getByRole('button', { name: 'Move education up' })
    const eduDown = page.getByRole('button', { name: 'Move education down' })
    await expect(roleUp.first()).toBeDisabled()
    await expect(roleUp.nth(1)).toBeEnabled()
    await expect(roleDown.nth(1)).toBeEnabled()
    await expect(roleDown.last()).toBeDisabled()
    await expect(eduUp.first()).toBeDisabled()
    await expect(eduDown.last()).toBeDisabled()
    await expect(eduUp.last()).toBeEnabled()
    await expect(eduDown.first()).toBeEnabled()

    // Move the first role down and the last education up
    await roleDown.first().click()
    await eduUp.last().click()
    await expect(page.getByText('The preview shows your last saved resume.')).toBeVisible()
    await expect.poll(() => valuesOf(titles)).toEqual([roleTitles[1], roleTitles[0], roleTitles[2]])
    await expect.poll(() => valuesOf(eduFields)).toEqual([fields[1], fields[0]])
    // Entries keep their own details when moved
    await expect(page.getByLabel('Role company').nth(1)).toHaveValue('Zeta Corp')
    await expect(page.getByLabel('Institution').first()).toHaveValue('State University')

    await saveResume(page)
    await expect(page.getByText('The preview shows your last saved resume.')).toHaveCount(0)

    const afterMove = await listVersionsApi(page.request)
    expect(afterMove).toHaveLength(2)
    const moved = await getProfileApi(page.request)
    expect(moved.id).not.toBe(original.id)
    expect(moved.content.roles.map((r) => r.title)).toEqual([roleTitles[1], roleTitles[0], roleTitles[2]])
    expect(moved.content.education!.map((e) => e.field)).toEqual([fields[1], fields[0]])

    // Order does not change the score
    const gapAfter = await getGap(page.request, job.id)
    expect(gapAfter.profileVersionId).toBe(moved.id)
    expect(gapAfter.score).toBe(gapBefore.score)
    expect(gapAfter.dimensions).toEqual(gapBefore.dimensions)

    // Preview and PDF follow the new order
    await page.getByRole('link', { name: 'Preview & download' }).click()
    const sheet = page.getByRole('article', { name: 'Resume' })
    await expect(sheet).toBeVisible()
    const text = (await sheet.textContent()) ?? ''
    expectInOrder(text, [`Alpha Developer ${token}`, `Zeta Lead ${token}`, `Mid Analyst ${token}`])
    expectInOrder(text, ['Bachelor, Computer Science', 'Master, Artificial Intelligence'])
    const { bytes } = await downloadPdf(page)
    const pdf = await pdfText(bytes)
    expectInOrder(pdf, [`Alpha Developer ${token}`, `Zeta Lead ${token}`, `Mid Analyst ${token}`])
    expectInOrder(pdf, ['Bachelor, Computer Science', 'Master, Artificial Intelligence'])

    // Saving again without changes adds nothing
    await page.getByRole('link', { name: 'Edit', exact: true }).click()
    await expect(page.getByLabel('Role title').first()).toHaveValue(roleTitles[1])
    await saveResume(page)
    expect(await listVersionsApi(page.request)).toHaveLength(2)
    expect((await getProfileApi(page.request)).id).toBe(moved.id)

    // Moving everything back and saving reuses the original version row
    await page.getByRole('button', { name: 'Move role up' }).nth(1).click()
    await page.getByRole('button', { name: 'Move education down' }).first().click()
    await expect.poll(() => valuesOf(page.getByLabel('Role title'))).toEqual(roleTitles)
    await expect.poll(() => valuesOf(page.getByLabel('Field of study'))).toEqual(fields)
    await saveResume(page)
    expect(await listVersionsApi(page.request)).toHaveLength(2)
    expect((await getProfileApi(page.request)).id).toBe(original.id)
  })

  test('shows the new order after a reload', async ({ page }) => {
    const token = uniqueToken()
    await registerUser(page.request)
    await saveProfileApi(page.request, fullResume(token))
    await page.goto('/resume')
    await expect(page.getByLabel('Role title')).toHaveCount(3)
    await page.getByRole('button', { name: 'Move role up' }).last().click()
    await saveResume(page)
    await page.reload()
    await expect.poll(() => valuesOf(page.getByLabel('Role title'))).toEqual([
      `Zeta Lead ${token}`,
      `Mid Analyst ${token}`,
      `Alpha Developer ${token}`,
    ])
  })

  test('disables both arrows for a single entry', async ({ page }) => {
    await registerUser(page.request)
    await saveProfileApi(page.request, profileContent({ education: [{ degreeLevel: 2, field: 'Solo' }] }))
    await page.goto('/resume')
    await expect(page.getByLabel('Role title')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Move role up' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Move role down' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Move education up' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Move education down' })).toBeDisabled()
  })
})

test.describe('editing a copy of an older version', () => {
  const setup = async (page: import('@playwright/test').Page) => {
    const token = uniqueToken()
    await registerUser(page.request, { name: 'Copy Person' })
    const a = await saveProfileApi(page.request, {
      ...fullResume(token),
      headline: `Headline A ${token}`,
    })
    const b = await saveProfileApi(page.request, {
      ...fullResume(token),
      headline: `Headline B ${token}`,
      roles: [{ title: `Only B role ${token}`, years: 4 }],
      contact: { phone: '+44 20 7946 0000', city: 'London' },
    })
    expect(await listVersionsApi(page.request)).toHaveLength(2)
    return { token, a, b }
  }

  test('loads the older content as an unsaved copy with the current contact details', async ({ page }) => {
    const { token, a, b } = await setup(page)
    await page.goto(`/resume?from=${a.id}`)

    const banner = page
      .getByRole('status')
      .filter({ hasText: /You are editing a copy of the version saved on .* Saving creates a new version; your current resume stays as it is until then\./ })
    await expect(banner).toBeVisible()
    await expect(page.getByRole('button', { name: 'Discard this copy' })).toBeVisible()
    await expect(page.getByLabel('Short professional headline')).toHaveValue(`Headline A ${token}`)
    expect(await valuesOf(page.getByLabel('Role title'))).toEqual([
      `Zeta Lead ${token}`,
      `Alpha Developer ${token}`,
      `Mid Analyst ${token}`,
    ])
    // Contact is not versioned: the copy carries today's details
    await expect(page.getByLabel('Phone')).toHaveValue('+44 20 7946 0000')
    await expect(page.getByLabel('City')).toHaveValue('London')

    // Nothing is saved yet
    const current = await getProfileApi(page.request)
    expect(current.id).toBe(b.id)
    expect(current.content.headline).toBe(`Headline B ${token}`)
    expect(await listVersionsApi(page.request)).toHaveLength(2)
  })

  test('saving an edited copy creates a new version and drops the from parameter', async ({ page }) => {
    const { token, a, b } = await setup(page)
    await page.goto(`/resume?from=${a.id}`)
    await expect(page.getByLabel('Short professional headline')).toHaveValue(`Headline A ${token}`)
    await expect(page.getByText('The preview shows your last saved resume.')).toHaveCount(0)

    await page.getByLabel('Short professional headline').fill(`Edited copy ${token}`)
    await expect(page.getByText('The preview shows your last saved resume.')).toBeVisible()
    await saveResume(page)

    await expect(page).toHaveURL(/\/resume$/)
    await expect(page.getByRole('status').filter({ hasText: 'You are editing a copy' })).toHaveCount(0)
    await expect(page.getByLabel('Short professional headline')).toHaveValue(`Edited copy ${token}`)
    // Roles are those of version A, not B
    await expect(page.getByLabel('Role title')).toHaveCount(3)

    const versions = await listVersionsApi(page.request)
    expect(versions).toHaveLength(3)
    const current = await getProfileApi(page.request)
    expect([a.id, b.id]).not.toContain(current.id)
    expect(current.content.headline).toBe(`Edited copy ${token}`)
    expect(current.content.roles).toHaveLength(3)
  })

  test('saving an unedited copy makes the original version current again without a new row', async ({ page }) => {
    const { token, a } = await setup(page)
    await page.goto(`/resume?from=${a.id}`)
    await expect(page.getByLabel('Short professional headline')).toHaveValue(`Headline A ${token}`)
    await saveResume(page)

    await expect(page).toHaveURL(/\/resume$/)
    expect(await listVersionsApi(page.request)).toHaveLength(2)
    expect((await getProfileApi(page.request)).id).toBe(a.id)
    await expect(page.getByLabel('Short professional headline')).toHaveValue(`Headline A ${token}`)
  })

  test('discarding the copy returns to the current resume without saving', async ({ page }) => {
    const { token, a, b } = await setup(page)
    await page.goto(`/resume?from=${a.id}`)
    await page.getByLabel('Short professional headline').fill('Throwaway edit')
    await page.getByRole('button', { name: 'Discard this copy' }).click()

    await expect(page).toHaveURL(/\/resume$/)
    await expect(page.getByRole('status').filter({ hasText: 'You are editing a copy' })).toHaveCount(0)
    await expect(page.getByLabel('Short professional headline')).toHaveValue(`Headline B ${token}`)
    await expect(page.getByLabel('Role title')).toHaveCount(1)
    await expect(page.getByText('The preview shows your last saved resume.')).toHaveCount(0)
    expect((await getProfileApi(page.request)).id).toBe(b.id)
    expect(await listVersionsApi(page.request)).toHaveLength(2)
  })

  test('keeps the copy being edited when the version list refetches in the background', async ({ page }) => {
    const { token, a } = await setup(page)
    await page.goto(`/resume?from=${a.id}`)
    await expect(page.getByLabel('Short professional headline')).toHaveValue(`Headline A ${token}`)
    await page.getByLabel('Short professional headline').fill('Typing in progress')

    const refetched = page.waitForResponse(
      (r) => r.url().endsWith('/api/candidate/profile/versions') && r.request().method() === 'GET',
    )
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })))
    await refetched

    await expect(page.getByLabel('Short professional headline')).toHaveValue('Typing in progress')
    await expect(page.getByLabel('Role title')).toHaveCount(3)
    await expect(page.getByRole('status').filter({ hasText: 'You are editing a copy' })).toBeVisible()
  })

  test('shows a toast and loads the current resume for an unknown version id', async ({ page }) => {
    const { token, b } = await setup(page)
    await page.goto(`/resume?from=${MISSING_ID}`)
    await expect(page.getByText('That version was not found')).toBeVisible()
    await expect(page).toHaveURL(/\/resume$/)
    await expect(page.getByLabel('Short professional headline')).toHaveValue(`Headline B ${token}`)
    await expect(page.getByRole('status').filter({ hasText: 'You are editing a copy' })).toHaveCount(0)
    expect((await getProfileApi(page.request)).id).toBe(b.id)
  })

  test('is offered from the preview of an older version', async ({ page }) => {
    const { token, a } = await setup(page)
    await page.goto(`/resume/preview?version=${a.id}`)
    await page.getByRole('link', { name: 'Edit a copy of this version' }).click()
    await expect(page).toHaveURL(`/resume?from=${a.id}`)
    await expect(page.getByLabel('Short professional headline')).toHaveValue(`Headline A ${token}`)
  })

  test('the history panel mentions that rearranging counts as a new version', async ({ page }) => {
    await registerUser(page.request)
    await page.goto('/resume')
    await expect(page.getByText(/Rearranging roles or education also counts as a new version/)).toBeVisible()
  })
})
