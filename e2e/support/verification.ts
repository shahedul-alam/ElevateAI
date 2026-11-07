import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { newUser, type TestUser } from './auth'
import { linkIn, waitForMail } from './mail'

// The verification stack (the "verification" project in playwright.config.ts): own client origin, API and database.
export const VERIFY_ORIGIN = 'http://localhost:5175'
// Better Auth checks the Origin of POSTs that carry a session; the browser sends it, so API calls add it.
export const ORIGIN = { Origin: VERIFY_ORIGIN }
export const VERIFY_SUBJECT = 'Verify your ElevateAI email'

/** Signs up on the verification stack. The answer is 201 with no session: the account must verify first. */
export async function signUpPending(request: APIRequestContext, overrides: Partial<TestUser> = {}) {
  const user = newUser(overrides)
  const res = await request.post('/api/auth/register', { data: user, headers: ORIGIN })
  expect(res.status(), await res.text()).toBe(201)
  return user
}

/** Opens the latest verification link from the mail in the page, as the user would. */
export async function openVerificationLink(page: Page, email: string) {
  await page.goto(linkIn(await waitForMail(email, VERIFY_SUBJECT)))
}

/** A verified account, with the page signed in to it (the link signs the browser in). */
export async function signedInVerifiedUser(page: Page, overrides: Partial<TestUser> = {}) {
  const user = await signUpPending(page.request, overrides)
  await openVerificationLink(page, user.email)
  await expect(page).toHaveURL('/verify-email')
  return user
}
