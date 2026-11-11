import { expect, test } from '@playwright/test'
import { newUser, PASSWORD, sessionCookie, uniqueEmail } from './support/auth'

test.describe('POST /api/auth/register', () => {
  for (const role of ['candidate', 'employer'] as const) {
    test(`creates a ${role}, sets the session cookie and signs the user in`, async ({ request }) => {
      const user = newUser({ role, name: `Some ${role}` })
      const res = await request.post('/api/auth/register', { data: user })
      expect(res.status()).toBe(201)
      const body = await res.json()
      expect(body.user).toMatchObject({ email: user.email, name: user.name, role })
      expect(body.user.id).toBeTruthy()
      expect(await sessionCookie(request)).toBeDefined()

      const me = await request.get('/api/me')
      expect(me.status()).toBe(200)
      expect((await me.json()).user).toMatchObject({ email: user.email, role })
    })
  }

  test('never returns the password or a hash', async ({ request }) => {
    const user = newUser()
    const res = await request.post('/api/auth/register', { data: user })
    const text = await res.text()
    expect(text).not.toContain(user.password)
    expect(text.toLowerCase()).not.toContain('hash')
    expect(Object.keys(JSON.parse(text).user).sort()).toEqual(['email', 'emailVerified', 'id', 'name', 'role'])
  })

  test('sets an HttpOnly, SameSite session cookie', async ({ request }) => {
    await request.post('/api/auth/register', { data: newUser() })
    const cookie = await sessionCookie(request)
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe('Lax')
    expect(cookie?.secure).toBe(false)
    expect(cookie?.path).toBe('/')
  })

  test('trims the name and normalises the email', async ({ request }) => {
    const email = uniqueEmail('mixed')
    const res = await request.post('/api/auth/register', {
      data: { name: '  Padded Name  ', email: `  ${email.toUpperCase()}  `, password: PASSWORD, role: 'candidate' },
    })
    expect(res.status()).toBe(201)
    expect((await res.json()).user).toMatchObject({ name: 'Padded Name', email })
  })

  test('rejects a duplicate email with 409, including a different case', async ({ request, playwright, baseURL }) => {
    const user = newUser()
    expect((await request.post('/api/auth/register', { data: user })).status()).toBe(201)

    const anon = await playwright.request.newContext({ baseURL })
    for (const email of [user.email, user.email.toUpperCase()]) {
      const res = await anon.post('/api/auth/register', { data: { ...user, email } })
      expect(res.status()).toBe(409)
      expect(await res.json()).toEqual({ error: { message: 'An account with this email already exists' } })
    }
    await anon.dispose()
  })

  test.describe('validation', () => {
    const cases: { name: string; data: Record<string, unknown>; field: string; message?: string }[] = [
      { name: 'empty name', data: { name: '' }, field: 'name', message: 'Name is required' },
      { name: 'whitespace-only name', data: { name: '   ' }, field: 'name', message: 'Name is required' },
      { name: 'name over 100 chars', data: { name: 'a'.repeat(101) }, field: 'name', message: 'Name must be at most 100 characters' },
      { name: 'empty email', data: { email: '' }, field: 'email', message: 'Enter a valid email address' },
      { name: 'malformed email', data: { email: 'not-an-email' }, field: 'email', message: 'Enter a valid email address' },
      { name: 'email without domain', data: { email: 'a@' }, field: 'email' },
      { name: 'short password', data: { password: 'abc1234' }, field: 'password', message: 'Password must be at least 8 characters' },
      { name: 'password without a digit', data: { password: 'abcdefghij' }, field: 'password', message: 'Password must contain a digit' },
      { name: 'password without a letter', data: { password: '1234567890' }, field: 'password', message: 'Password must contain a letter' },
      { name: 'password over 128 chars', data: { password: `a1${'x'.repeat(127)}` }, field: 'password', message: 'Password must be at most 128 characters' },
      { name: 'non-string password', data: { password: 12345678 }, field: 'password' },
      { name: 'missing role', data: { role: undefined }, field: 'role' },
      { name: 'empty role', data: { role: '' }, field: 'role' },
      { name: 'admin role', data: { role: 'admin' }, field: 'role', message: 'Role must be one of: candidate, employer' },
      { name: 'unknown role', data: { role: 'superuser' }, field: 'role' },
      { name: 'wrong-case role', data: { role: 'Candidate' }, field: 'role' },
      { name: 'array role', data: { role: ['admin'] }, field: 'role' },
    ]

    for (const c of cases) {
      test(`returns 400 for ${c.name}`, async ({ request }) => {
        const res = await request.post('/api/auth/register', { data: { ...newUser(), ...c.data } })
        expect(res.status()).toBe(400)
        const body = await res.json()
        expect(body.error.message).toBe('Invalid request')
        const detail = body.error.details.find((d: { field: string }) => d.field === c.field)
        expect(detail, JSON.stringify(body)).toBeDefined()
        if (c.message) expect(detail.message).toBe(c.message)
        expect(await sessionCookie(request)).toBeUndefined()
      })
    }

    test('reports every invalid field for an empty body', async ({ request }) => {
      const res = await request.post('/api/auth/register', { data: {} })
      expect(res.status()).toBe(400)
      const fields = (await res.json()).error.details.map((d: { field: string }) => d.field)
      expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password', 'role']))
    })

    test('accepts a password at the minimum and maximum length', async ({ request }) => {
      expect((await request.post('/api/auth/register', { data: newUser({ password: 'abcdefg1' }) })).status()).toBe(201)
      expect((await request.post('/api/auth/register', { data: newUser({ password: `a1${'x'.repeat(126)}` }) })).status()).toBe(201)
    })

    test('does not create an account when validation fails', async ({ request, playwright, baseURL }) => {
      const user = newUser({ role: 'admin' as never })
      expect((await request.post('/api/auth/register', { data: user })).status()).toBe(400)
      const anon = await playwright.request.newContext({ baseURL })
      const login = await anon.post('/api/auth/login', { data: { email: user.email, password: user.password } })
      expect(login.status()).toBe(401)
      await anon.dispose()
    })
  })

  test('ignores unknown fields and cannot self-assign admin through extra fields', async ({ request }) => {
    const user = newUser()
    const res = await request.post('/api/auth/register', {
      data: { ...user, isAdmin: true, emailVerified: true, id: 'custom-id', userRole: 'admin', image: 'x' },
    })
    expect(res.status()).toBe(201)
    const { user: created } = await res.json()
    expect(created.role).toBe('candidate')
    expect(created.id).not.toBe('custom-id')
    const me = await request.get('/api/me')
    expect((await me.json()).user.role).toBe('candidate')
  })

  test('returns 400 for malformed JSON with the standard error shape', async ({ request }) => {
    const res = await request.post('/api/auth/register', {
      headers: { 'Content-Type': 'application/json' },
      data: '{"name": "x", ',
    })
    expect(res.status()).toBe(400)
    expect(typeof (await res.json()).error.message).toBe('string')
  })

  test('rejects a non-object JSON body with a 4xx', async ({ request }) => {
    const res = await request.post('/api/auth/register', {
      headers: { 'Content-Type': 'application/json' },
      data: '"just a string"',
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })

  test('is not throttled by repeated sign-ups outside production', async ({ request }) => {
    for (let i = 0; i < 8; i++) {
      const res = await request.post('/api/auth/register', { data: newUser() })
      expect(res.status()).toBe(201)
    }
  })
})
