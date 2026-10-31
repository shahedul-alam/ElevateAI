import { test as base, type Page } from '@playwright/test'
import { registerUser, type TestUser } from './auth'

type Fixtures = {
  /** The user the signed-in browser context belongs to. */
  currentUser: TestUser
  /** A page whose browser context is already signed in as a fresh candidate, on the home page. */
  authenticatedPage: Page
}

export const test = base.extend<Fixtures>({
  currentUser: async ({ page }, use) => {
    // page.request shares the cookie jar with the browser context.
    await use(await registerUser(page.request))
  },
  authenticatedPage: async ({ page, currentUser }, use) => {
    void currentUser
    await page.goto('/')
    await use(page)
  },
})

export { expect } from '@playwright/test'
