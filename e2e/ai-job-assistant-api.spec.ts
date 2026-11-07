import { expect, test, type APIRequestContext } from '@playwright/test'
import { registerUser } from './support/auth'

// Only paths that fail before the model is called: never send a valid (20..12000 char) text here.
const draft = (request: APIRequestContext, data?: unknown) =>
  request.post('/api/employer/jobs/ai-draft', { data })

test.describe('job assistant access', () => {
  test('rejects anonymous requests with 401', async ({ request }) => {
    expect((await draft(request, { text: 'x'.repeat(10) })).status()).toBe(401)
  })

  test('forbids candidates with 403', async ({ request }) => {
    await registerUser(request, { role: 'candidate' })
    expect((await draft(request, { text: 'x'.repeat(10) })).status()).toBe(403)
  })
})

test.describe('job assistant input validation', () => {
  const cases = [
    { name: 'a missing body', data: undefined },
    { name: 'an empty object', data: {} },
    { name: 'empty text', data: { text: '' } },
    { name: 'text shorter than 20 characters', data: { text: 'x'.repeat(19) } },
    { name: 'whitespace padding around short text', data: { text: `   ${'x'.repeat(10)}   ` } },
    { name: 'text over 12000 characters', data: { text: 'x'.repeat(12_001) } },
    { name: 'a non-string text', data: { text: 12345 } },
  ]
  for (const c of cases) {
    test(`returns 400 for ${c.name}`, async ({ request }) => {
      await registerUser(request, { role: 'employer' })
      const res = await draft(request, c.data)
      expect(res.status()).toBe(400)
      const body = await res.json()
      expect(body.error.message).toBe('Invalid request')
      const fields = body.error.details.map((d: { field: string }) => d.field)
      // With no body at all the whole input is invalid, so the error is reported on the root (empty field name).
      expect(fields).toContain(c.data === undefined ? '' : 'text')
    })
  }
})
