import { expect, test, type Page } from '@playwright/test'
import { registerUser } from './support/auth'
import { applyCandidate } from './support/hiring'
import { JPEG_1X1, pngImage, pngOfSize, webpImage } from './support/images'
import { PHOTO_LIMIT, uploadPhotoApi } from './support/photo'
import { applyApi, publishReactJob, reactProfile } from './support/matching'
import { profileContent, saveProfileApi } from './support/profile'
import { downloadPdf } from './support/resume'

let counter = 0
const token = () => `${Date.now().toString(36)}${(counter += 1)}`

const photoOf = (page: Page, name: string) => page.getByRole('img', { name: `Photo of ${name}` })

/** Picks a file in the photo card's file input (the label is "Choose photo" or "Change photo"). */
const pickPhoto = (page: Page, file: { name: string; mimeType: string; buffer: Buffer }) =>
  page.getByLabel(/^(Choose|Change) photo$/).setInputFiles(file)

test.describe('resume photo card', () => {
  test('uploads a photo, keeps it after a reload, and removes it', async ({ page }) => {
    const name = `Photo Person ${token()}`
    await registerUser(page.request, { name })
    await page.goto('/resume')

    await pickPhoto(page, { name: 'me.png', mimeType: 'image/png', buffer: pngImage(50) })
    await expect(page.getByText('Photo saved')).toBeVisible()
    await expect(photoOf(page, name)).toHaveJSProperty('naturalWidth', 1)
    await expect(page.getByLabel('Change photo')).toBeVisible()

    await page.reload()
    await expect(photoOf(page, name)).toHaveJSProperty('naturalWidth', 1)

    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(page.getByText('Photo removed')).toBeVisible()
    await expect(photoOf(page, name)).toHaveCount(0)
    await expect(page.getByLabel('Choose photo')).toBeVisible()
  })

  test('refuses a WebP file in the browser and sends nothing', async ({ page }) => {
    await registerUser(page.request)
    await page.goto('/resume')
    await expect(page.getByLabel('Choose photo')).toBeVisible()

    const sent: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'PUT' && r.url().includes('/candidate/profile/photo')) sent.push(r.url())
    })
    await pickPhoto(page, { name: 'me.webp', mimeType: 'image/webp', buffer: webpImage() })
    await expect(page.getByText('Use a PNG or JPEG image')).toBeVisible()
    expect(sent).toEqual([])
  })

  test('refuses a photo over 512 KB in the browser and sends nothing', async ({ page }) => {
    await registerUser(page.request)
    await page.goto('/resume')
    await expect(page.getByLabel('Choose photo')).toBeVisible()

    const sent: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'PUT' && r.url().includes('/candidate/profile/photo')) sent.push(r.url())
    })
    await pickPhoto(page, { name: 'big.png', mimeType: 'image/png', buffer: pngOfSize(PHOTO_LIMIT + 1) })
    await expect(page.getByText('The photo must be under 512 KB')).toBeVisible()
    expect(sent).toEqual([])
  })

  test('a JPEG photo is decoded and shown on the card and the preview', async ({ page }) => {
    const name = `Jpeg Person ${token()}`
    await registerUser(page.request, { name })
    await saveProfileApi(page.request, profileContent())
    await page.goto('/resume')

    await pickPhoto(page, { name: 'me.jpg', mimeType: 'image/jpeg', buffer: JPEG_1X1 })
    await expect(page.getByText('Photo saved')).toBeVisible()
    await expect(photoOf(page, name)).toHaveJSProperty('naturalWidth', 1)

    await page.goto('/resume/preview')
    await expect(page.getByRole('article', { name: 'Resume' }).getByRole('img', { name: `Photo of ${name}` })).toHaveJSProperty(
      'naturalWidth',
      1,
    )
    // The PDF embeds the same photo, so it must still build.
    const { bytes } = await downloadPdf(page)
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF')
  })

  test('shows the photo on the resume preview', async ({ page }) => {
    const name = `Preview Photo ${token()}`
    await registerUser(page.request, { name })
    await saveProfileApi(page.request, profileContent())
    await uploadPhotoApi(page.request, pngImage(51))

    await page.goto('/resume/preview')
    const sheet = page.getByRole('article', { name: 'Resume' })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('img', { name: `Photo of ${name}` })).toHaveJSProperty('naturalWidth', 1)
  })
})

test.describe('photo on an application', () => {
  test('an employer sees the photo sent with the application, even after the candidate removes it', async ({
    page,
    browser,
    baseURL,
  }) => {
    const employerContext = await browser.newContext({ baseURL })
    await registerUser(employerContext.request, { role: 'employer' })
    const job = await publishReactJob(employerContext.request, 3)

    const name = `Applied Photo ${token()}`
    const candidate = await registerUser(page.request, { name })
    await saveProfileApi(page.request, reactProfile(3))
    await page.goto('/resume')
    await pickPhoto(page, { name: 'me.png', mimeType: 'image/png', buffer: pngImage(52) })
    await expect(page.getByText('Photo saved')).toBeVisible()

    await page.goto(`/jobs/${job.id}`)
    await page.getByRole('button', { name: 'Apply with your current resume' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Submit application' }).click()
    await expect(page.getByText('Application sent')).toBeVisible()

    const employer = await employerContext.newPage()
    await employer.goto('/employer/hiring')
    const row = employer.getByRole('listitem').filter({ hasText: candidate.email })
    await expect(row.getByRole('img', { name: `Photo of ${name}` })).toHaveJSProperty('naturalWidth', 1)

    // The candidate takes the photo away after applying; the employer keeps the one they received.
    await page.goto('/resume')
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(page.getByText('Photo removed')).toBeVisible()

    await employer.reload()
    await expect(employer.getByRole('listitem').filter({ hasText: candidate.email }).getByRole('img', { name: `Photo of ${name}` })).toHaveJSProperty(
      'naturalWidth',
      1,
    )
    await employerContext.close()
  })

  test('an applicant who applied without a photo shows initials and no image', async ({ page, playwright, baseURL }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishReactJob(page.request, 3)
    const plain = await applyCandidate(playwright, baseURL, 'Plain Candidate', job.id, reactProfile(3))

    await page.goto('/employer/hiring')
    const row = page.getByRole('listitem').filter({ hasText: plain.user.email })
    await expect(row.getByText('PC', { exact: true })).toBeVisible()
    await expect(row.getByRole('img', { name: /^Photo of/ })).toHaveCount(0)

    await plain.ctx.dispose()
  })

  test('a photo added after applying is not shown to the employer', async ({ page, playwright, baseURL }) => {
    await registerUser(page.request, { role: 'employer' })
    const job = await publishReactJob(page.request, 3)
    const late = await playwright.request.newContext({ baseURL })
    const user = await registerUser(late, { role: 'candidate', name: `Late Photo ${token()}` })
    await saveProfileApi(late, reactProfile(3))
    await applyApi(late, job.id)
    await uploadPhotoApi(late, pngImage(53))

    await page.goto('/employer/hiring')
    const row = page.getByRole('listitem').filter({ hasText: user.email })
    await expect(row.getByText('Late Photo', { exact: false })).toBeVisible()
    await expect(row.getByRole('img', { name: /^Photo of/ })).toHaveCount(0)

    await late.dispose()
  })
})
