import { expect, test, type Page } from '@playwright/test'
import { ADMIN, createUser, newUser } from './support/auth'

async function submit(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

test.describe('login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Welcome back to ElevateAI.')).toBeVisible()
  })

  test('signs in an existing user and shows them in the navbar', async ({ page }) => {
    const user = await createUser(page.request, { name: 'Lena Login' })
    await submit(page, user.email, user.password)

    await expect(page).toHaveURL('/')
    await expect(page.getByText('Signed in')).toBeVisible()
    await expect(page.getByRole('button', { name: user.name })).toBeVisible()
    expect((await page.request.get('/api/me')).status()).toBe(200)
  })

  test('accepts the email in a different case with surrounding spaces', async ({ page }) => {
    const user = await createUser(page.request)
    await submit(page, `  ${user.email.toUpperCase()} `, user.password)
    await expect(page).toHaveURL('/')
  })

  test('signs in the seeded admin', async ({ page }) => {
    await submit(page, ADMIN.email, ADMIN.password)
    await expect(page).toHaveURL('/')
    await page.getByRole('button', { name: 'Admin' }).click()
    await expect(page.getByText(`${ADMIN.email} · admin`)).toBeVisible()
  })

  test('shows one generic toast and clears the password on a wrong password', async ({ page }) => {
    const user = await createUser(page.request)
    await submit(page, user.email, 'wrong-password-1')

    await expect(page.getByText('Sign in failed')).toBeVisible()
    await expect(page.getByText('Invalid email or password')).toBeVisible()
    await expect(page.getByLabel('Password')).toHaveValue('')
    await expect(page.getByLabel('Email')).toHaveValue(user.email)
    await expect(page).toHaveURL('/login')
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('shows the same message for an unknown email as for a wrong password', async ({ page }) => {
    await submit(page, newUser().email, 'wrong-password-1')
    await expect(page.getByText('Sign in failed')).toBeVisible()
    await expect(page.getByText('Invalid email or password')).toBeVisible()
    await expect(page.getByLabel('Password')).toHaveValue('')
    await expect(page.getByText(/unknown email|does not exist/i)).toHaveCount(0)
  })

  test('shows validation errors and sends nothing for an empty form', async ({ page }) => {
    let called = false
    await page.route('**/api/auth/login', (route) => {
      called = true
      return route.continue()
    })
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByText('Enter a valid email address')).toBeVisible()
    await expect(page.getByText('Password is required')).toBeVisible()
    expect(called).toBe(false)
  })

  test('rejects a malformed email', async ({ page }) => {
    await submit(page, 'nope', 'whatever1')
    await expect(page.getByText('Enter a valid email address')).toBeVisible()
  })

  test('does not apply password strength rules on login', async ({ page }) => {
    await submit(page, newUser().email, 'x')
    await expect(page.getByText('Sign in failed')).toBeVisible()
    await expect(page.getByText('Password must')).toHaveCount(0)
  })

  test('shows the throttle message on a 429', async ({ page }) => {
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Too many sign-in attempts, try again later' } }),
      }),
    )
    await submit(page, newUser().email, 'whatever1')
    await expect(page.getByText('Too many attempts')).toBeVisible()
  })

  test('shows a generic error when the server is unreachable', async ({ page }) => {
    await page.route('**/api/auth/login', (route) => route.abort())
    await submit(page, newUser().email, 'whatever1')
    await expect(page.getByText('Sign in failed')).toBeVisible()
    await expect(page.getByText('Cannot reach the server. Check your connection and try again.')).toBeVisible()
  })

  test('can retry successfully after a failed attempt', async ({ page }) => {
    const user = await createUser(page.request)
    await submit(page, user.email, 'wrong-password-1')
    await expect(page.getByText('Invalid email or password')).toBeVisible()
    await page.getByLabel('Password').fill(user.password)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL('/')
  })

  test('links to the sign up page', async ({ page }) => {
    await page.getByRole('main').getByRole('link', { name: 'Sign up' }).click()
    await expect(page).toHaveURL('/register')
  })
})
