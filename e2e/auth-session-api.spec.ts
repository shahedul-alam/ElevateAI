import { expect, test } from '@playwright/test'
import { CLIENT_ORIGIN, createUser, registerUser, sessionCookie, SESSION_COOKIE } from './support/auth'

test.describe('session (API)', () => {
  test('GET /api/me returns 401 with the standard error shape without a cookie', async ({ request }) => {
    const res = await request.get('/api/me')
    expect(res.status()).toBe(401)
    expect(await res.json()).toEqual({ error: { message: 'Unauthorized' } })
  })

  test('GET /api/me returns only public fields for a signed-in user', async ({ request }) => {
    const user = await registerUser(request, { role: 'employer' })
    const res = await request.get('/api/me')
    expect(res.status()).toBe(200)
    const { user: me } = await res.json()
    expect(me).toMatchObject({ email: user.email, name: user.name, role: 'employer' })
    expect(Object.keys(me).sort()).toEqual(['aiConsent', 'email', 'emailVerified', 'id', 'name', 'role'])
    expect(me.aiConsent).toBe(false) // a new account has not agreed to the AI privacy notice
  })

  test('rejects a garbage session cookie', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { Cookie: `${SESSION_COOKIE}=not-a-real-token` },
    })
    expect((await ctx.get('/api/me')).status()).toBe(401)
    await ctx.dispose()
  })

  test('rejects a session cookie with a tampered signature', async ({ request, playwright, baseURL }) => {
    await registerUser(request)
    const raw = decodeURIComponent((await sessionCookie(request))!.value)
    const tampered = `${raw.slice(0, -4)}AAAA`
    const ctx = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { Cookie: `${SESSION_COOKIE}=${encodeURIComponent(tampered)}` },
    })
    expect((await ctx.get('/api/me')).status()).toBe(401)
    await ctx.dispose()
  })

  test('rejects a token whose signature was stripped', async ({ request, playwright, baseURL }) => {
    await registerUser(request)
    const raw = decodeURIComponent((await sessionCookie(request))!.value)
    const ctx = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { Cookie: `${SESSION_COOKIE}=${raw.split('.')[0]}` },
    })
    expect((await ctx.get('/api/me')).status()).toBe(401)
    await ctx.dispose()
  })

  test('sign-out ends the session: /api/me is 401 afterwards, even replaying the old cookie', async ({ request, playwright, baseURL }) => {
    await registerUser(request)
    const oldCookie = await sessionCookie(request)

    const out = await request.post('/api/auth/sign-out', { headers: { Origin: CLIENT_ORIGIN } })
    expect(out.status()).toBe(200)
    expect((await request.get('/api/me')).status()).toBe(401)
    expect(await sessionCookie(request)).toBeUndefined()

    const replay = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { Cookie: `${SESSION_COOKIE}=${oldCookie!.value}` },
    })
    expect((await replay.get('/api/me')).status()).toBe(401)
    await replay.dispose()
  })

  test('sign-in after sign-out starts a fresh session', async ({ request }) => {
    const user = await createUser(request)
    const res = await request.post('/api/auth/login', { data: { email: user.email, password: user.password } })
    expect(res.status()).toBe(200)
    expect((await request.get('/api/me')).status()).toBe(200)
  })

  test('sign-out from a foreign origin is refused and keeps the session', async ({ request }) => {
    await registerUser(request)
    const res = await request.post('/api/auth/sign-out', { headers: { Origin: 'http://evil.example' } })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect((await request.get('/api/me')).status()).toBe(200)
  })

  test('two sessions for one user are independent', async ({ request, playwright, baseURL }) => {
    const user = await createUser(request)
    const other = await playwright.request.newContext({ baseURL })
    await request.post('/api/auth/login', { data: { email: user.email, password: user.password } })
    await other.post('/api/auth/login', { data: { email: user.email, password: user.password } })

    await request.post('/api/auth/sign-out', { headers: { Origin: CLIENT_ORIGIN } })
    expect((await request.get('/api/me')).status()).toBe(401)
    expect((await other.get('/api/me')).status()).toBe(200)
    await other.dispose()
  })
})

test.describe('raw Better Auth endpoints', () => {
  for (const path of ['/api/auth/sign-up/email', '/api/auth/sign-in/email']) {
    test(`POST ${path} is blocked with 404`, async ({ request }) => {
      const res = await request.post(path, {
        data: { name: 'x', email: 'raw@e2e.test', password: 'abcdefg123', role: 'candidate' },
      })
      expect(res.status()).toBe(404)
      expect(await res.json()).toEqual({ error: { message: 'Not found' } })
      expect(await sessionCookie(request)).toBeUndefined()
    })
  }

  test('POST /api/auth/update-user cannot change the role', async ({ request }) => {
    await registerUser(request)
    const res = await request.post('/api/auth/update-user', {
      headers: { Origin: CLIENT_ORIGIN },
      data: { role: 'admin' },
    })
    expect(res.status()).toBe(400)
    expect((await (await request.get('/api/me')).json()).user.role).toBe('candidate')
  })

  test('POST /api/auth/update-user still updates harmless fields and the role stays', async ({ request }) => {
    await registerUser(request)
    const res = await request.post('/api/auth/update-user', {
      headers: { Origin: CLIENT_ORIGIN },
      data: { name: 'Renamed' },
    })
    expect(res.status()).toBe(200)
    const me = (await (await request.get('/api/me')).json()).user
    expect(me).toMatchObject({ name: 'Renamed', role: 'candidate' })
  })

  test('update-user requires a session', async ({ request }) => {
    const res = await request.post('/api/auth/update-user', { headers: { Origin: CLIENT_ORIGIN }, data: { name: 'x' } })
    expect(res.status()).toBe(401)
  })

  test('unknown routes return the standard 404 shape', async ({ request }) => {
    const res = await request.get('/api/does-not-exist')
    expect(res.status()).toBe(404)
    expect(await res.json()).toEqual({ error: { message: 'Not found' } })
  })
})
