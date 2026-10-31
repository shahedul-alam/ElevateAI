import { expect, test } from '@playwright/test'
import { newUser, PASSWORD, sessionCookie, uniqueEmail } from './support/auth'

test.describe('register page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByText('Join ElevateAI as a candidate or employer.')).toBeVisible()
  })

  async function fill(page: import('@playwright/test').Page, u: { name: string; email: string; password: string }) {
    await page.getByLabel('Name').fill(u.name)
    await page.getByLabel('Email').fill(u.email)
    await page.getByLabel('Password').fill(u.password)
  }

  test('defaults to the candidate role', async ({ page }) => {
    await expect(page.getByRole('radio', { name: 'Candidate' })).toBeChecked()
    await expect(page.getByRole('radio', { name: 'Employer' })).not.toBeChecked()
  })

  test('registers a candidate, lands signed in on the home page', async ({ page }) => {
    const user = newUser({ name: 'Casey Candidate' })
    await fill(page, user)
    await page.getByRole('button', { name: 'Sign up' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByText('Account created')).toBeVisible()
    await expect(page.getByRole('button', { name: user.name })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Log in' })).toHaveCount(0)
    expect(await sessionCookie(page.request)).toBeDefined()

    const me = await page.request.get('/api/me')
    expect((await me.json()).user).toMatchObject({ email: user.email, role: 'candidate' })
  })

  test('registers an employer when the employer role is chosen', async ({ page }) => {
    const user = newUser({ name: 'Erin Employer' })
    await page.getByRole('radio', { name: 'Employer' }).click()
    await expect(page.getByRole('radio', { name: 'Employer' })).toBeChecked()
    await fill(page, user)
    await page.getByRole('button', { name: 'Sign up' }).click()

    await expect(page).toHaveURL('/')
    await page.getByRole('button', { name: user.name }).click()
    await expect(page.getByText(`${user.email} · employer`)).toBeVisible()
  })

  test('lowercases and trims the email before sending', async ({ page }) => {
    const email = uniqueEmail('case')
    await fill(page, { name: 'Mixed Case', email: `  ${email.toUpperCase()}  `, password: PASSWORD })
    await page.getByRole('button', { name: 'Sign up' }).click()
    await expect(page).toHaveURL('/')
    const me = await page.request.get('/api/me')
    expect((await me.json()).user.email).toBe(email)
  })

  test('shows required-field errors and sends nothing for an empty form', async ({ page }) => {
    let called = false
    await page.route('**/api/auth/register', (route) => {
      called = true
      return route.continue()
    })
    await page.getByRole('button', { name: 'Sign up' }).click()
    await expect(page.getByText('Name is required')).toBeVisible()
    await expect(page.getByText('Enter a valid email address')).toBeVisible()
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible()
    await expect(page).toHaveURL('/register')
    expect(called).toBe(false)
  })

  test('rejects a malformed email', async ({ page }) => {
    await fill(page, { ...newUser(), email: 'not-an-email' })
    await page.getByRole('button', { name: 'Sign up' }).click()
    await expect(page.getByText('Enter a valid email address')).toBeVisible()
  })

  for (const [label, password, message] of [
    ['too short', 'abc123', 'Password must be at least 8 characters'],
    ['has no digit', 'abcdefghij', 'Password must contain a digit'],
    ['has no letter', '1234567890', 'Password must contain a letter'],
  ] as const) {
    test(`rejects a password that ${label}`, async ({ page }) => {
      await fill(page, { ...newUser(), password })
      await page.getByRole('button', { name: 'Sign up' }).click()
      await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible()
      await expect(page).toHaveURL('/register')
    })
  }

  test('rejects a whitespace-only name', async ({ page }) => {
    await fill(page, { ...newUser(), name: '   ' })
    await page.getByRole('button', { name: 'Sign up' }).click()
    await expect(page.getByText('Name is required')).toBeVisible()
  })

  test('rejects a name over 100 characters', async ({ page }) => {
    await fill(page, { ...newUser(), name: 'a'.repeat(101) })
    await page.getByRole('button', { name: 'Sign up' }).click()
    await expect(page.getByText('Name must be at most 100 characters')).toBeVisible()
  })

  test('shows an inline error and a toast for an already registered email', async ({ page, playwright, baseURL }) => {
    const user = newUser()
    const anon = await playwright.request.newContext({ baseURL })
    expect((await anon.post('/api/auth/register', { data: user })).status()).toBe(201)
    await anon.dispose()

    await fill(page, user)
    await page.getByRole('button', { name: 'Sign up' }).click()
    await expect(page.getByText('Email already registered')).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'An account with this email already exists' })).toBeVisible()
    await expect(page).toHaveURL('/register')
    await expect(page.getByRole('link', { name: 'Log in' }).first()).toBeVisible()
  })

  test('maps server-side validation details onto fields', async ({ page }) => {
    await page.route('**/api/auth/register', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'Invalid request', details: [{ field: 'password', message: 'Server says no' }] },
        }),
      }),
    )
    await fill(page, newUser())
    await page.getByRole('button', { name: 'Sign up' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Server says no' })).toBeVisible()
    await expect(page.getByText('Sign up failed')).toBeVisible()
  })

  test('shows the throttle message on a 429', async ({ page }) => {
    await page.route('**/api/auth/register', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Too many sign-up attempts, try again later' } }),
      }),
    )
    await fill(page, newUser())
    await page.getByRole('button', { name: 'Sign up' }).click()
    await expect(page.getByText('Too many attempts')).toBeVisible()
  })

  test('links to the login page', async ({ page }) => {
    await page.getByRole('main').getByRole('link', { name: 'Log in' }).click()
    await expect(page).toHaveURL('/login')
  })
})
