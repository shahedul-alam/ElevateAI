import { expect, test } from '@playwright/test'
import { ADMIN, createUser, newUser, sessionCookie } from './support/auth'

test.describe('POST /api/auth/login', () => {
  test('signs in with valid credentials and sets the session cookie', async ({ request }) => {
    const user = await createUser(request, { role: 'employer' })
    expect(await sessionCookie(request)).toBeUndefined()

    const res = await request.post('/api/auth/login', { data: { email: user.email, password: user.password } })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.user).toMatchObject({ email: user.email, name: user.name, role: 'employer' })
    expect(Object.keys(body.user).sort()).toEqual(['email', 'emailVerified', 'id', 'name', 'role'])
    expect(JSON.stringify(body)).not.toContain(user.password)

    const cookie = await sessionCookie(request)
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe('Lax')
    expect((await (await request.get('/api/me')).json()).user.email).toBe(user.email)
  })

  test('treats the email as case-insensitive and ignores surrounding whitespace', async ({ request }) => {
    const user = await createUser(request)
    const res = await request.post('/api/auth/login', {
      data: { email: `  ${user.email.toUpperCase()} `, password: user.password },
    })
    expect(res.status()).toBe(200)
    expect((await res.json()).user.email).toBe(user.email)
  })

  test('keeps the password case-sensitive', async ({ request }) => {
    const user = await createUser(request)
    const res = await request.post('/api/auth/login', { data: { email: user.email, password: user.password.toUpperCase() } })
    expect(res.status()).toBe(401)
  })

  test('wrong password and unknown email give the identical generic 401', async ({ request }) => {
    const user = await createUser(request)
    const wrongPassword = await request.post('/api/auth/login', { data: { email: user.email, password: 'wrong-password-1' } })
    const unknownEmail = await request.post('/api/auth/login', { data: { email: newUser().email, password: 'wrong-password-1' } })

    expect(wrongPassword.status()).toBe(401)
    expect(unknownEmail.status()).toBe(401)
    expect(await wrongPassword.json()).toEqual({ error: { message: 'Invalid email or password' } })
    expect(await unknownEmail.json()).toEqual(await wrongPassword.json())
    expect(await sessionCookie(request)).toBeUndefined()
  })

  test('signs in the seeded admin with role admin', async ({ request }) => {
    const res = await request.post('/api/auth/login', { data: ADMIN })
    expect(res.status()).toBe(200)
    expect((await res.json()).user).toMatchObject({ email: ADMIN.email, role: 'admin' })
    expect((await (await request.get('/api/me')).json()).user.role).toBe('admin')
  })

  test.describe('validation', () => {
    const cases = [
      { name: 'empty body', data: {}, fields: ['email', 'password'] },
      { name: 'empty email', data: { email: '', password: 'x' }, fields: ['email'] },
      { name: 'malformed email', data: { email: 'nope', password: 'x' }, fields: ['email'] },
      { name: 'empty password', data: { email: 'a@e2e.test', password: '' }, fields: ['password'] },
      { name: 'missing password', data: { email: 'a@e2e.test' }, fields: ['password'] },
      { name: 'password over 128 chars', data: { email: 'a@e2e.test', password: 'x'.repeat(129) }, fields: ['password'] },
      { name: 'non-string email', data: { email: { ne: null }, password: 'x' }, fields: ['email'] },
    ]
    for (const c of cases) {
      test(`returns 400 for ${c.name}`, async ({ request }) => {
        const res = await request.post('/api/auth/login', { data: c.data })
        expect(res.status()).toBe(400)
        const body = await res.json()
        expect(body.error.message).toBe('Invalid request')
        const fields = body.error.details.map((d: { field: string }) => d.field)
        for (const f of c.fields) expect(fields).toContain(f)
      })
    }

    test('returns 400 for malformed JSON', async ({ request }) => {
      const res = await request.post('/api/auth/login', {
        headers: { 'Content-Type': 'application/json' },
        data: '{"email": ',
      })
      expect(res.status()).toBe(400)
      expect(typeof (await res.json()).error.message).toBe('string')
    })
  })

  test('is not throttled by repeated attempts outside production', async ({ request }) => {
    const user = await createUser(request)
    for (let i = 0; i < 8; i++) {
      const bad = await request.post('/api/auth/login', { data: { email: user.email, password: 'wrong-password-1' } })
      expect(bad.status()).toBe(401)
    }
    const ok = await request.post('/api/auth/login', { data: { email: user.email, password: user.password } })
    expect(ok.status()).toBe(200)
  })
})
