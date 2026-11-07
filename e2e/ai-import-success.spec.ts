import { expect, test } from '@playwright/test'
import { DOCX_MIME, importResumeApi, PDF_MIME, STUB_FAIL, tinyDocx, tinyPdf } from './support/ai'
import { grantAiConsent, registerUser } from './support/auth'
import { getProfileApi, profileContent, saveProfileApi } from './support/profile'

// AI_STUB is on: the import always returns the canned extraction, whatever the file holds.
const pdf = { name: 'resume.pdf', mimeType: PDF_MIME, buffer: tinyPdf() }

test.describe('resume import API with the stubbed model', () => {
  test('maps a PDF to profile content and saves nothing', async ({ request }) => {
    await registerUser(request)
    await grantAiConsent(request)

    const res = await importResumeApi(request, tinyPdf())
    expect(res.status(), await res.text()).toBe(200)
    const { content, termNames } = await res.json()
    expect(content).toMatchObject({
      headline: 'Stub Engineer',
      skills: [
        { termId: 'skill:react', level: 4, years: 6 },
        { termId: 'skill:typescript', level: 3, years: 4 },
      ],
      unmapped: ['Zorblax'],
      roles: [{ title: 'Stub Engineer', company: 'Stub Co', years: 6, domainId: 'domain:fintech' }],
      education: [{ degreeLevel: 2, field: 'Computer Science', institution: 'Stub University' }],
      certIds: ['certification:aws-solutions-architect'],
      leadershipLevel: 0,
      preferences: { locations: [], workModes: [] },
    })
    expect(termNames['skill:react']).toBe('React')

    expect((await (await request.get('/api/candidate/profile')).json()).profile).toBeNull()
  })

  test('maps a DOCX the same way', async ({ request }) => {
    await registerUser(request)
    await grantAiConsent(request)
    const res = await importResumeApi(request, tinyDocx('Some resume text'), DOCX_MIME)
    expect(res.status(), await res.text()).toBe(200)
    expect((await res.json()).content.headline).toBe('Stub Engineer')
  })

  test('answers 422 for a DOCX with no text', async ({ request }) => {
    await registerUser(request)
    await grantAiConsent(request)
    const res = await importResumeApi(request, tinyDocx(''), DOCX_MIME)
    expect(res.status()).toBe(422)
    expect((await res.json()).error.message).toBe('No text found in the resume')
  })

  test('answers 502 when the model fails on a DOCX containing the failure marker', async ({ request }) => {
    await registerUser(request)
    await grantAiConsent(request)
    const res = await importResumeApi(request, tinyDocx(`Resume ${STUB_FAIL}`), DOCX_MIME)
    expect(res.status()).toBe(502)
  })
})

test.describe('resume import card with the stubbed model', () => {
  test('fills the form, marks it unsaved and saves only on Save', async ({ page }) => {
    await registerUser(page.request)
    await grantAiConsent(page.request)
    await page.goto('/resume')
    await expect(page.getByText('Import from a resume')).toBeVisible()

    await page.locator('#resume-import').setInputFiles(pdf)

    await expect(page.getByLabel('Short professional headline')).toHaveValue('Stub Engineer')
    await expect(page.getByText('Resume imported')).toBeVisible()
    await expect(page.getByText('Unsaved changes')).toBeVisible()
    await expect(page.getByLabel('React level')).toHaveValue('4')
    await expect(page.getByLabel('React years')).toHaveValue('6')
    await expect(page.getByLabel('TypeScript level')).toHaveValue('3')
    await expect(page.getByLabel('Other skills (not scored yet)')).toHaveValue(/Zorblax/)
    await expect(page.getByLabel('Role title')).toHaveValue('Stub Engineer')
    await expect(page.getByLabel('Institution')).toHaveValue('Stub University')

    // Nothing is stored yet.
    expect((await (await page.request.get('/api/candidate/profile')).json()).profile).toBeNull()

    const saved = page.waitForResponse((r) => r.url().endsWith('/api/candidate/profile') && r.request().method() === 'PUT')
    await page.getByRole('button', { name: 'Save resume' }).click()
    expect((await saved).status()).toBe(200)

    const profile = await getProfileApi(page.request)
    expect(profile.content.headline).toBe('Stub Engineer')
    expect(profile.content.skills.map((s) => s.termId).sort()).toEqual(['skill:react', 'skill:typescript'])
    expect(profile.content.unmapped).toEqual(['Zorblax'])
  })

  test('asks before replacing a form that already has content', async ({ page }) => {
    await registerUser(page.request)
    await grantAiConsent(page.request)
    await saveProfileApi(page.request, profileContent({ headline: 'Existing headline' }))
    await page.goto('/resume')
    const headline = page.getByLabel('Short professional headline')
    await expect(headline).toHaveValue('Existing headline')

    await page.locator('#resume-import').setInputFiles(pdf)
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByText('Replace what is in the form?')).toBeVisible()

    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    await expect(headline).toHaveValue('Existing headline')

    await page.locator('#resume-import').setInputFiles(pdf)
    await dialog.getByRole('button', { name: 'Import' }).click()
    await expect(headline).toHaveValue('Stub Engineer')
    await expect(page.getByText('Unsaved changes')).toBeVisible()
    // Still the old resume on the server.
    expect((await getProfileApi(page.request)).content.headline).toBe('Existing headline')
  })

  test('shows an error toast when the model fails on a DOCX', async ({ page }) => {
    await registerUser(page.request)
    await grantAiConsent(page.request)
    await page.goto('/resume')
    await expect(page.getByText('Import from a resume')).toBeVisible()

    await page
      .locator('#resume-import')
      .setInputFiles({ name: 'resume.docx', mimeType: DOCX_MIME, buffer: tinyDocx(`Resume ${STUB_FAIL}`) })
    await expect(page.getByText('Could not import')).toBeVisible()
    await expect(page.getByLabel('Short professional headline')).toHaveValue('')
  })
})
