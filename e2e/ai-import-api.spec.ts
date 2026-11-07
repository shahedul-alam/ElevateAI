import { expect, test, type APIRequestContext } from '@playwright/test'
import { grantAiConsent, registerUser } from './support/auth'

// Only paths that fail before the model is called: never upload a valid PDF/DOCX here.
const PDF = 'application/pdf'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const LIMIT = 5 * 1024 * 1024

const importResume = (request: APIRequestContext, body: Buffer, contentType: string) =>
  request.post('/api/candidate/profile/import', { data: body, headers: { 'Content-Type': contentType } })

test.describe('resume import access', () => {
  test('rejects anonymous requests with 401', async ({ request }) => {
    expect((await importResume(request, Buffer.from('x'), PDF)).status()).toBe(401)
  })

  test('forbids employers with 403', async ({ request }) => {
    await registerUser(request, { role: 'employer' })
    expect((await importResume(request, Buffer.from('x'), PDF)).status()).toBe(403)
  })
})

test.describe('resume import file checks', () => {
  test('rejects an empty body with 415', async ({ request }) => {
    await registerUser(request)
    await grantAiConsent(request)
    expect((await importResume(request, Buffer.alloc(0), PDF)).status()).toBe(415)
  })

  test('rejects junk bytes sent as a PDF with 415', async ({ request }) => {
    await registerUser(request)
    await grantAiConsent(request)
    expect((await importResume(request, Buffer.from('this is not a pdf'), PDF)).status()).toBe(415)
  })

  test('rejects a zip that is not a DOCX with 415', async ({ request }) => {
    await registerUser(request)
    await grantAiConsent(request)
    // Zip local file header followed by an unrelated entry name.
    const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('plain.txt just a zip')])
    expect((await importResume(request, zip, DOCX)).status()).toBe(415)
  })

  test('rejects a body over 5 MB with 413', async ({ request }) => {
    await registerUser(request)
    await grantAiConsent(request)
    expect((await importResume(request, Buffer.alloc(LIMIT + 1), PDF)).status()).toBe(413)
  })
})
