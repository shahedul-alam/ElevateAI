import { expect, test, type APIRequestContext } from '@playwright/test'
import { ADMIN } from './support/auth'
import { listAdminUsers, restoreUserApi, suspendUserApi } from './support/admin'
import { linkIn, waitForMail } from './support/mail'
import { ORIGIN, VERIFY_SUBJECT, VERIFY_ORIGIN, signUpPending, signedInVerifiedUser } from './support/verification'

const RESET_SUBJECT = 'Reset your ElevateAI password'
const NEW_PASSWORD = 'brand-new-pass-2'

// The verification stack seeds the same admin as the default stack (ADMIN_EMAIL/PASSWORD in playwright.config.ts).
test.describe('sign-in paths that bypass login stay closed for a suspended user', () => {
  let admin: APIRequestContext

  test.beforeEach(async ({ playwright }) => {
    admin = await playwright.request.newContext({ baseURL: VERIFY_ORIGIN, extraHTTPHeaders: ORIGIN })
    const res = await admin.post('/api/auth/login', { data: ADMIN })
    expect(res.status(), await res.text()).toBe(200)
  })

  test.afterEach(async () => {
    await admin.dispose()
  })

  const userId = async (email: string) => (await listAdminUsers(admin, { q: email })).users[0]!.id

  test('a password reset does not sign a suspended user in, and login works again after a restore', async ({ page }) => {
    const user = await signedInVerifiedUser(page)
    const id = await userId(user.email)
    await page.context().clearCookies()
    expect((await suspendUserApi(admin, id)).status()).toBe(200)

    await page.goto('/forgot-password')
    await page.getByLabel('Email').fill(user.email)
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await page.goto(linkIn(await waitForMail(user.email, RESET_SUBJECT)))
    await page.getByLabel('New password').fill(NEW_PASSWORD)
    await page.getByRole('button', { name: 'Update password' }).click()
    await expect(page.getByText('Password updated')).toBeVisible()

    expect((await page.request.get('/api/me')).status()).toBe(401)
    const login = await page.request.post('/api/auth/login', {
      data: { email: user.email, password: NEW_PASSWORD },
      headers: ORIGIN,
    })
    expect(login.status()).toBe(403)
    expect((await login.json()).error.message).toBe('Account suspended')

    expect((await restoreUserApi(admin, id)).status()).toBe(200)
    const again = await page.request.post('/api/auth/login', {
      data: { email: user.email, password: NEW_PASSWORD },
      headers: ORIGIN,
    })
    expect(again.status(), await again.text()).toBe(200)
    expect((await page.request.get('/api/me')).status()).toBe(200)
  })

  test('the email verification link does not sign a suspended user in', async ({ page }) => {
    const user = await signUpPending(page.request)
    const verifyMail = await waitForMail(user.email, VERIFY_SUBJECT)
    expect((await suspendUserApi(admin, await userId(user.email))).status()).toBe(200)

    await page.goto(linkIn(verifyMail))
    expect((await page.request.get('/api/me')).status()).toBe(401)
  })
})
