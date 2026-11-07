import { expect, test } from '@playwright/test'
import { newUser, sessionCookie } from './support/auth'
import { linkIn, mailCount, waitForMail } from './support/mail'
import { ORIGIN, signUpPending, VERIFY_ORIGIN, VERIFY_SUBJECT } from './support/verification'

test.describe('POST /api/auth/register with email verification on', () => {
  test('creates the account without a session and reports that verification is required', async ({ request }) => {
    const user = newUser({ name: 'Vera Verify' })
    const res = await request.post('/api/auth/register', { data: user, headers: ORIGIN })
    expect(res.status()).toBe(201)
    expect(await res.json()).toMatchObject({
      user: { email: user.email, name: user.name, role: 'candidate' },
      verificationRequired: true,
    })
    expect(await sessionCookie(request)).toBeUndefined()
    expect((await request.get('/api/me')).status()).toBe(401)
  })

  test('answers a duplicate email the same way and mails the owner, without touching the account', async ({ request }) => {
    const owner = await signUpPending(request, { name: 'Original Owner' })
    const attempt = newUser({ email: owner.email, password: 'an-attacker-pass-1', name: 'Imposter' })
    const res = await request.post('/api/auth/register', { data: attempt, headers: ORIGIN })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.verificationRequired).toBe(true)
    expect(await sessionCookie(request)).toBeUndefined()

    // The owner gets the notice (sign-in and reset links), and nothing else changes.
    const notice = await waitForMail(owner.email, 'Sign-up attempt with your email')
    expect(notice.text).toContain('/login')
    expect(notice.text).toContain('/forgot-password')

    // Once the owner verifies, the original password works and the attempted one does not.
    const verify = await request.get(linkIn(await waitForMail(owner.email, VERIFY_SUBJECT)), { maxRedirects: 0 })
    expect(verify.status()).toBe(302)
    const login = (password: string) =>
      request.post('/api/auth/login', { data: { email: owner.email, password }, headers: ORIGIN })
    expect((await login(attempt.password)).status()).toBe(401)
    expect((await login(owner.password)).status()).toBe(200)
  })
})

test.describe('POST /api/auth/login before verifying', () => {
  test('refuses a correct password with 403 and no session, and mails a fresh link', async ({ request }) => {
    const user = await signUpPending(request)
    const res = await request.post('/api/auth/login', {
      data: { email: user.email, password: user.password },
      headers: ORIGIN,
    })
    expect(res.status()).toBe(403)
    expect(await res.json()).toEqual({ error: { message: 'Email not verified' } })
    expect(await sessionCookie(request)).toBeUndefined()
    await expect.poll(() => mailCount(user.email, VERIFY_SUBJECT)).toBe(2)
  })

  test('answers a wrong password with 401, so the unverified state is only shown to the right password', async ({ request }) => {
    const user = await signUpPending(request)
    const res = await request.post('/api/auth/login', {
      data: { email: user.email, password: 'wrong-password-1' },
      headers: ORIGIN,
    })
    expect(res.status()).toBe(401)
    expect(await res.json()).toEqual({ error: { message: 'Invalid email or password' } })
  })
})

test.describe('verification link', () => {
  test('a valid link verifies the account and signs the caller in', async ({ request }) => {
    const user = await signUpPending(request)
    const link = linkIn(await waitForMail(user.email, VERIFY_SUBJECT))
    const res = await request.get(link, { maxRedirects: 0 })
    expect(res.status()).toBe(302)
    expect(res.headers().location).toBe(`${VERIFY_ORIGIN}/verify-email`)
    expect(await sessionCookie(request)).toBeDefined()

    const login = await request.post('/api/auth/login', {
      data: { email: user.email, password: user.password },
      headers: ORIGIN,
    })
    expect(login.status()).toBe(200)
  })

  test('a made-up token redirects with INVALID_TOKEN and signs nobody in', async ({ request }) => {
    const callback = encodeURIComponent(`${VERIFY_ORIGIN}/verify-email`)
    const res = await request.get(`/api/auth/verify-email?token=made-up-token&callbackURL=${callback}`, {
      maxRedirects: 0,
    })
    expect(res.status()).toBe(302)
    expect(res.headers().location).toBe(`${VERIFY_ORIGIN}/verify-email?error=INVALID_TOKEN`)
    expect(await sessionCookie(request)).toBeUndefined()
  })
})

test.describe('verification mail', () => {
  test('is multipart: the link is in the text part and html-escaped in the html part', async ({ request }) => {
    const user = await signUpPending(request)
    const mail = await waitForMail(user.email, VERIFY_SUBJECT)
    expect(mail.contentType).toMatch(/^multipart\/alternative/)

    const link = linkIn(mail)
    expect(link).toContain('/api/auth/verify-email?token=')
    expect(link).toContain('&callbackURL=')
    expect(mail.text).toContain(`Verify email: ${link}`)
    // The html part escapes "&" in the href; the raw "&callbackURL" must not appear there.
    expect(mail.html).toContain(`href="${link.replaceAll('&', '&amp;')}"`)
    expect(mail.html).not.toContain('&callbackURL')
  })
})
