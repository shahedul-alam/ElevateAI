import { expect, test, type Page } from '@playwright/test'
import { newUser } from './support/auth'
import { linkIn, mailsTo, waitForMail } from './support/mail'
import { ORIGIN, signedInVerifiedUser, VERIFY_ORIGIN } from './support/verification'

const RESET_SUBJECT = 'Reset your ElevateAI password'
const SENT = 'If an account exists for that email, a reset link is on its way.'
const NEW_PASSWORD = 'brand-new-pass-2'

/** Opens the forgot-password page and submits the email; the same confirmation comes back either way. */
async function requestReset(page: Page, email: string) {
  await page.goto('/forgot-password')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByText(SENT)).toBeVisible()
}

/** A verified account, signed out again. */
async function signedOutVerifiedUser(page: Page) {
  const user = await signedInVerifiedUser(page)
  await page.context().clearCookies()
  return user
}

test.describe('forgot password', () => {
  test('gives the same confirmation for known and unknown emails, and mails only the known one', async ({ page }) => {
    const user = await signedOutVerifiedUser(page)
    const unknown = newUser().email

    await requestReset(page, unknown)
    await requestReset(page, user.email)

    await waitForMail(user.email, RESET_SUBJECT)
    // The unknown request was answered first, so its mail would already be there by now.
    expect(await mailsTo(unknown)).toHaveLength(0)
  })

  test('shows a validation error and sends nothing for a malformed email', async ({ page }) => {
    let sent = false
    await page.route('**/api/auth/request-password-reset', (route) => {
      sent = true
      return route.continue()
    })
    await page.goto('/forgot-password')
    await page.getByLabel('Email').fill('not-an-email')
    await page.getByRole('button', { name: 'Send reset link' }).click()

    await expect(page.getByText('Enter a valid email address')).toBeVisible()
    expect(sent).toBe(false)
  })
})

test.describe('reset password', () => {
  test('sets a new password from the emailed link, and the old password stops working', async ({ page }) => {
    const user = await signedOutVerifiedUser(page)
    await requestReset(page, user.email)
    const link = linkIn(await waitForMail(user.email, RESET_SUBJECT))

    await page.goto(link)
    await expect(page.getByText('Choose a new password')).toBeVisible()
    await page.getByLabel('New password').fill(NEW_PASSWORD)
    await page.getByRole('button', { name: 'Update password' }).click()
    await expect(page.getByText('Password updated')).toBeVisible()
    await expect(page).toHaveURL('/login')

    const login = (password: string) =>
      page.request.post('/api/auth/login', { data: { email: user.email, password }, headers: ORIGIN })
    expect((await login(user.password)).status()).toBe(401)
    expect((await login(NEW_PASSWORD)).status()).toBe(200)

    // The link works once: opening it again is an expired link.
    await page.goto(link)
    await expect(page.getByText('Link expired or invalid')).toBeVisible()
  })

  test('signs out the other sessions when the password is reset', async ({ page, browser }) => {
    const user = await signedOutVerifiedUser(page)
    const other = await browser.newContext({ baseURL: VERIFY_ORIGIN })
    try {
      const res = await other.request.post('/api/auth/login', {
        data: { email: user.email, password: user.password },
        headers: ORIGIN,
      })
      expect(res.status()).toBe(200)
      expect((await other.request.get('/api/me')).status()).toBe(200)

      await requestReset(page, user.email)
      const link = linkIn(await waitForMail(user.email, RESET_SUBJECT))
      await page.goto(link)
      await page.getByLabel('New password').fill(NEW_PASSWORD)
      await page.getByRole('button', { name: 'Update password' }).click()
      await expect(page.getByText('Password updated')).toBeVisible()

      expect((await other.request.get('/api/me')).status()).toBe(401)
    } finally {
      await other.close()
    }
  })

  test('shows Link expired or invalid when there is no token', async ({ page }) => {
    await page.goto('/reset-password')
    await expect(page.getByText('Link expired or invalid')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Request a new link' })).toBeVisible()
  })

  test('shows an error toast when a made-up token is submitted', async ({ page }) => {
    await page.goto('/reset-password?token=made-up-token')
    await page.getByLabel('New password').fill(NEW_PASSWORD)
    await page.getByRole('button', { name: 'Update password' }).click()

    await expect(page.getByText('Could not reset password')).toBeVisible()
    await expect(page).toHaveURL(/\/reset-password\?token=made-up-token$/)
  })

  test('rejects a weak new password before sending anything', async ({ page }) => {
    let sent = false
    await page.route('**/api/auth/reset-password', (route) => {
      sent = true
      return route.continue()
    })
    await page.goto('/reset-password?token=made-up-token')

    await page.getByLabel('New password').fill('short1')
    await page.getByRole('button', { name: 'Update password' }).click()
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible()

    await page.getByLabel('New password').fill('lettersonly')
    await page.getByRole('button', { name: 'Update password' }).click()
    await expect(page.getByText('Password must contain a digit')).toBeVisible()
    expect(sent).toBe(false)
  })
})
