import { expect, test, type Page } from '@playwright/test'
import { registerUser } from './support/auth'

// Both cases are refused in the browser, so nothing is sent (success paths: ai-import-success.spec.ts).
const pick = (page: Page, file: { name: string; mimeType: string; buffer: Buffer }) =>
  page.locator('#resume-import').setInputFiles(file)

test.describe('resume import card', () => {
  test('is shown on the resume page', async ({ page }) => {
    await registerUser(page.request)
    await page.goto('/resume')
    await expect(page.getByText('Import from a resume')).toBeVisible()
    await expect(page.getByText('Choose PDF or DOCX')).toBeVisible()
  })

  test('refuses a file of the wrong type and sends nothing', async ({ page }) => {
    await registerUser(page.request)
    await page.goto('/resume')
    await expect(page.getByText('Import from a resume')).toBeVisible()

    const sent: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/candidate/profile/import')) sent.push(r.url())
    })
    await pick(page, { name: 'resume.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
    await expect(page.getByText('Use a PDF or DOCX file')).toBeVisible()
    expect(sent).toEqual([])
  })

  test('refuses a file over 5 MB and sends nothing', async ({ page }) => {
    await registerUser(page.request)
    await page.goto('/resume')
    await expect(page.getByText('Import from a resume')).toBeVisible()

    const sent: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/candidate/profile/import')) sent.push(r.url())
    })
    await pick(page, { name: 'big.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) })
    await expect(page.getByText('The file must be under 5 MB')).toBeVisible()
    expect(sent).toEqual([])
  })
})
