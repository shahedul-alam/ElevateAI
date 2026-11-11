import { expect, test, type Page } from '@playwright/test'
import { newUser, PASSWORD } from './support/auth'
import { mailCount } from './support/mail'
import { openVerificationLink, signUpPending, VERIFY_ORIGIN, VERIFY_SUBJECT } from './support/verification'

async function fillRegister(page: Page, user: { name: string; email: string; password: string }) {
  await page.getByLabel('Name').fill(user.name)
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign up' }).click()
}

async function fillLogin(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

test.describe('sign-up with verification on', () => {
  test('shows Check your inbox and does not sign the user in', async ({ page }) => {
    await page.goto('/register')
    const user = newUser({ name: 'Nora New' })
    await fillRegister(page, user)

    await expect(page.getByText('Check your inbox')).toBeVisible()
    await expect(page.getByText(`We sent a verification link to ${user.email}`)).toBeVisible()
    expect((await page.request.get('/api/me')).status()).toBe(401)

    // Not signed in, so the login page stays put instead of redirecting home.
    await page.goto('/login')
    await expect(page.getByText('Welcome back to ElevateAI.')).toBeVisible()
  })

  test('resend starts a countdown and sends another link', async ({ page }) => {
    await page.goto('/register')
    const user = newUser()
    await fillRegister(page, user)
    await expect(page.getByText('Check your inbox')).toBeVisible()

    await page.getByRole('button', { name: 'Resend email' }).click()
    await expect(page.getByText('Verification email sent')).toBeVisible()
    await expect(page.getByRole('button', { name: /Resend email \(\d+s\)/ })).toBeDisabled()
    await expect.poll(() => mailCount(user.email, VERIFY_SUBJECT)).toBe(2)
  })

  test('shows the same Check your inbox for an email that is already registered', async ({ page }) => {
    const owner = await signUpPending(page.request)
    await page.goto('/register')
    await fillRegister(page, newUser({ email: owner.email, password: 'another-pass-2' }))

    await expect(page.getByText('Check your inbox')).toBeVisible()
    await expect(page.getByText('Email already registered')).toHaveCount(0)
    await expect(page.getByText('Sign up failed')).toHaveCount(0)
  })
})

test.describe('log in before verifying', () => {
  test('shows the verify notice with a resend button that counts down', async ({ page }) => {
    const user = await signUpPending(page.request)
    await page.goto('/login')
    await fillLogin(page, user.email, user.password)

    const notice = page.getByRole('alert').filter({ hasText: 'Verify your email first' })
    await expect(notice).toBeVisible()
    await expect(page).toHaveURL('/login')
    const resend = notice.getByRole('button', { name: /Resend email/ })
    await expect(resend).toBeDisabled()
    await expect(resend).toHaveText(/Resend email \(\d+s\)/)
  })

  test('shows the generic error, not the notice, for a wrong password', async ({ page }) => {
    const user = await signUpPending(page.request)
    await page.goto('/login')
    await fillLogin(page, user.email, 'wrong-password-1')

    await expect(page.getByText('Sign in failed')).toBeVisible()
    await expect(page.getByText('Invalid email or password')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
})

test.describe('verification link', () => {
  test('verifies the email, signs the browser in, and login works afterwards', async ({ page }) => {
    const user = await signUpPending(page.request)
    await openVerificationLink(page, user.email)

    await expect(page).toHaveURL('/verify-email')
    await expect(page.getByText('Email verified')).toBeVisible()
    expect((await page.request.get('/api/me')).status()).toBe(200)

    await page.context().clearCookies()
    await page.goto('/login')
    await fillLogin(page, user.email, PASSWORD)
    await expect(page.getByText('Signed in')).toBeVisible()
    await expect(page).toHaveURL('/')
  })

  test('shows Verification failed for a link that does not verify', async ({ page }) => {
    const callback = encodeURIComponent(`${VERIFY_ORIGIN}/verify-email`)
    await page.goto(`/api/auth/verify-email?token=made-up-token&callbackURL=${callback}`)

    await expect(page.getByText('Verification failed')).toBeVisible()
    await expect(page).toHaveURL(/\/verify-email\?error=INVALID_TOKEN$/)
    await expect(page.getByRole('link', { name: 'Go to log in' })).toBeVisible()
  })
})
