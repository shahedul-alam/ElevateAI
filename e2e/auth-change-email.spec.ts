import { expect, test, type Page } from '@playwright/test'
import { uniqueEmail } from './support/auth'
import { linkIn, mailCount, mailsTo, waitForMail } from './support/mail'
import { ORIGIN, signedInVerifiedUser, signUpPending, VERIFY_SUBJECT } from './support/verification'

const APPROVE_SUBJECT = 'Approve your ElevateAI email change'
const NAME = 'Mira Mail'

/** The signed-in user's email, as the server sees it. */
async function currentEmail(page: Page) {
  const res = await page.request.get('/api/me')
  return (await res.json()).user.email as string
}

/** Opens Change email from the user menu. */
async function openChangeEmail(page: Page) {
  await page.getByRole('button', { name: NAME }).click()
  await page.getByText('Change email').click()
  await expect(page).toHaveURL('/account')
}

async function requestChange(page: Page, newEmail: string) {
  await page.getByLabel('New email').fill(newEmail)
  await page.getByRole('button', { name: 'Send approval link' }).click()
}

test.describe('change email', () => {
  test('redirects an anonymous visit to log in', async ({ page }) => {
    await page.goto('/account')
    await expect(page).toHaveURL('/login')
  })

  test('changes the address only after both links are opened', async ({ page }) => {
    const user = await signedInVerifiedUser(page, { name: NAME })
    const newEmail = uniqueEmail('new')
    await openChangeEmail(page)
    await requestChange(page, newEmail)
    await expect(page.getByText(`We sent an approval link to ${user.email}`)).toBeVisible()

    // Step one goes to the current address only.
    const approval = await waitForMail(user.email, APPROVE_SUBJECT)
    expect(approval.text).toContain(newEmail)
    expect(await mailsTo(newEmail)).toHaveLength(0)
    expect(await currentEmail(page)).toBe(user.email)

    // Opening the approval link sends the verification link to the new address; the account still has the old one.
    await page.goto(linkIn(approval))
    await expect(page).toHaveURL('/verify-email?change=1')
    await expect(page.getByText('Change approved')).toBeVisible()
    await expect(page.getByText('Email verified')).toHaveCount(0)
    await expect.poll(() => mailCount(newEmail, VERIFY_SUBJECT)).toBe(1)
    expect(await currentEmail(page)).toBe(user.email)

    // Only the second link moves the account, and the new address then logs in.
    await page.goto(linkIn(await waitForMail(newEmail, VERIFY_SUBJECT)))
    await expect(page.getByText('Email changed')).toBeVisible()
    expect(await currentEmail(page)).toBe(newEmail)
    const login = await page.request.post('/api/auth/login', {
      data: { email: newEmail, password: user.password },
      headers: ORIGIN,
    })
    expect(login.status()).toBe(200)
  })

  test('refuses the address the account already has', async ({ page }) => {
    const user = await signedInVerifiedUser(page, { name: NAME })
    await openChangeEmail(page)
    await requestChange(page, user.email)

    await expect(page.getByText('Could not change email')).toBeVisible()
    await expect(page.getByText(`We sent an approval link`)).toHaveCount(0)
    expect(await mailCount(user.email, APPROVE_SUBJECT)).toBe(0)
  })

  test('answers an address that belongs to someone else the same way, and sends no mail', async ({ page }) => {
    const other = await signUpPending(page.request)
    const user = await signedInVerifiedUser(page, { name: NAME })
    await openChangeEmail(page)
    await requestChange(page, other.email)

    await expect(page.getByText(`We sent an approval link to ${user.email}`)).toBeVisible()
    await expect(page.getByText('Could not change email')).toHaveCount(0)
    expect(await mailCount(user.email, APPROVE_SUBJECT)).toBe(0)
    expect(await mailCount(other.email, APPROVE_SUBJECT)).toBe(0)
    expect(await currentEmail(page)).toBe(user.email)
  })
})
