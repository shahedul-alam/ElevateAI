import { expect, test } from '@playwright/test'
import { registerUser } from './support/auth'
import { listVersionsApi, profileContent, saveProfileApi } from './support/profile'
import {
  CONTACT,
  PRIVATE,
  collectErrors,
  downloadPdf,
  expectHeadingsInOrder,
  expectInOrder,
  fullResume,
  pdfText,
} from './support/resume'

let counter = 0
const uniqueToken = () => `P${Date.now().toString(36)}${(counter += 1)}`

test.describe('resume PDF download', () => {
  test('downloads the current version as a real-text PDF with the expected content', async ({ page }) => {
    const token = uniqueToken()
    const user = await registerUser(page.request, { name: 'Pdf Person' })
    await saveProfileApi(page.request, fullResume(token))
    const errors = collectErrors(page)

    await page.goto('/resume/preview')
    await expect(page.getByRole('article', { name: 'Resume' })).toBeVisible()
    const { filename, bytes } = await downloadPdf(page)

    expect(filename).toBe('Pdf-Person-Resume.pdf')
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF')

    const text = await pdfText(bytes)
    expect(text).toContain(user.name)
    expect(text).toContain(`Platform engineer ${token}`)
    for (const value of [CONTACT.email, CONTACT.phone, 'Toronto, Canada', CONTACT.linkedin, CONTACT.github]) {
      expect(text).toContain(value)
    }
    // The PDF upper-cases and letter-spaces its headings
    expectHeadingsInOrder(text, ['Summary', 'Skills', 'Experience', 'Education', 'Certifications', 'Additional'])
    expectInOrder(text, [`Zeta Lead ${token}, Zeta Corp`, `Alpha Developer ${token}, Alpha Inc`, `Mid Analyst ${token}`])
    expectInOrder(text, ['Master, Artificial Intelligence', 'Bachelor, Computer Science'])
    expectInOrder(text, ['AWS Certified Developer', 'AWS Certified Solutions Architect'])
    expect(text).toContain('Python (Expert, 6 yrs)')
    expect(text).toContain('Leadership: Manager')
    expect(text).toContain('Other skills: Bash scripting, Kanban')

    // Job preferences never reach the PDF
    expect(text).not.toContain(PRIVATE.location)
    expect(text).not.toContain(String(PRIVATE.minSalary))
    expect(text).not.toContain('987,654')
    expect(text.toLowerCase()).not.toContain(PRIVATE.workMode)

    expect(errors).toEqual([])
  })

  test('an older version downloads with a dated filename and only that version content', async ({ page }) => {
    const token = uniqueToken()
    await registerUser(page.request, { name: 'Old Version' })
    const a = await saveProfileApi(
      page.request,
      profileContent({ headline: `Headline A ${token}`, roles: [{ title: `Role A ${token}`, years: 1 }] }),
    )
    await saveProfileApi(
      page.request,
      profileContent({ headline: `Headline B ${token}`, roles: [{ title: `Role B ${token}`, years: 2 }] }),
    )
    const aRow = (await listVersionsApi(page.request)).find((v) => v.id === a.id)!
    const errors = collectErrors(page)

    await page.goto(`/resume/preview?version=${a.id}`)
    await expect(page.getByRole('article', { name: 'Resume' })).toContainText(`Headline A ${token}`)
    const { filename, bytes } = await downloadPdf(page)

    expect(filename).toBe(`Old-Version-Resume-${aRow.createdAt.slice(0, 10)}.pdf`)
    const text = await pdfText(bytes)
    expect(text).toContain(`Headline A ${token}`)
    expect(text).toContain(`Role A ${token}`)
    expect(text).not.toContain(`Headline B ${token}`)
    expect(text).not.toContain(`Role B ${token}`)
    expect(errors).toEqual([])
  })

  test('builds the file name from the account name with accents removed', async ({ page }) => {
    await registerUser(page.request, { name: 'José Núñez' })
    await saveProfileApi(page.request, profileContent())
    await page.goto('/resume/preview')
    await expect(page.getByRole('article', { name: 'Resume' })).toBeVisible()
    const { filename, bytes } = await downloadPdf(page)
    expect(filename).toBe('Jose-Nunez-Resume.pdf')
    // Accented Latin letters are within Helvetica's range: still in the PDF text
    expect(await pdfText(bytes)).toContain('José Núñez')
    await expect(page.getByRole('status').filter({ hasText: 'outside the Latin alphabet' })).toHaveCount(0)
  })

  test('warns about non-Latin text but still downloads', async ({ page }) => {
    const token = uniqueToken()
    await registerUser(page.request, { name: 'Multi Script' })
    await saveProfileApi(
      page.request,
      profileContent({
        headline: `Engineer ${token}`,
        summary: 'আমি একজন সফটওয়্যার প্রকৌশলী। ソフトウェアエンジニア',
      }),
    )
    const errors = collectErrors(page)

    await page.goto('/resume/preview')
    const sheet = page.getByRole('article', { name: 'Resume' })
    await expect(sheet).toContainText('ソフトウェアエンジニア')
    await expect(
      page.getByRole('status').filter({ hasText: 'Your resume contains characters outside the Latin alphabet' }),
    ).toBeVisible()

    const { filename, bytes } = await downloadPdf(page)
    expect(filename).toBe('Multi-Script-Resume.pdf')
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF')
    expect(await pdfText(bytes)).toContain(`Engineer ${token}`)
    expect(errors).toEqual([])
  })

  test('can be downloaded twice in a row', async ({ page }) => {
    const token = uniqueToken()
    await registerUser(page.request, { name: 'Twice Person' })
    await saveProfileApi(page.request, profileContent({ headline: `Twice ${token}` }))
    const errors = collectErrors(page)

    await page.goto('/resume/preview')
    await expect(page.getByRole('article', { name: 'Resume' })).toBeVisible()
    const first = await downloadPdf(page)
    await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled()
    const second = await downloadPdf(page)

    expect(first.filename).toBe('Twice-Person-Resume.pdf')
    expect(second.filename).toBe(first.filename)
    for (const file of [first, second]) {
      expect(file.bytes.subarray(0, 4).toString('latin1')).toBe('%PDF')
      expect(await pdfText(file.bytes)).toContain(`Twice ${token}`)
    }
    expect(errors).toEqual([])
  })
})
