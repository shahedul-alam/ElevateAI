import { expect, test } from './support/fixtures'
import { CLIENT_ORIGIN, registerUser, SESSION_COOKIE } from './support/auth'

test.describe('session in the browser', () => {
  test('anonymous visitors see Log in / Sign up in the navbar', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('banner').getByRole('link', { name: 'Log in' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0)
  })

  test('the navbar placeholder shows while /api/me is pending, then the signed-in user', async ({ page, currentUser }) => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    await page.route('**/api/me', async (route) => {
      await gate
      await route.continue()
    })
    await page.goto('/')
    // Neither the anonymous links nor the user menu are rendered while loading.
    await expect(page.getByRole('banner').getByRole('link', { name: 'Log in' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: currentUser.name })).toHaveCount(0)
    release()
    await expect(page.getByRole('button', { name: currentUser.name })).toBeVisible()
  })

  test('restores the session after a reload', async ({ authenticatedPage: page, currentUser }) => {
    await expect(page.getByRole('button', { name: currentUser.name })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: currentUser.name })).toBeVisible()
    await expect(page.getByRole('banner').getByRole('link', { name: 'Log in' })).toHaveCount(0)
  })

  test('restores the session in a new tab of the same browser context', async ({ authenticatedPage: page, currentUser }) => {
    const other = await page.context().newPage()
    await other.goto('/')
    await expect(other.getByRole('button', { name: currentUser.name })).toBeVisible()
  })

  test('signing out from the navbar clears the UI and the server session', async ({ authenticatedPage: page, currentUser }) => {
    await page.getByRole('button', { name: currentUser.name }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()

    await expect(page.getByRole('banner').getByRole('link', { name: 'Log in' })).toBeVisible()
    await expect(page).toHaveURL('/')
    await expect.poll(async () => (await page.request.get('/api/me')).status()).toBe(401)

    await page.reload()
    await expect(page.getByRole('banner').getByRole('link', { name: 'Log in' })).toBeVisible()
  })

  test('after signing out the login page is reachable again', async ({ authenticatedPage: page, currentUser }) => {
    await page.getByRole('button', { name: currentUser.name }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page.getByRole('banner').getByRole('link', { name: 'Log in' })).toBeVisible()
    await page.getByRole('banner').getByRole('link', { name: 'Log in' }).click()
    await expect(page).toHaveURL('/login')
    await expect(page.getByText('Welcome back to ElevateAI.')).toBeVisible()
  })

  test('an invalid session cookie is treated as anonymous', async ({ page, baseURL }) => {
    await page.context().addCookies([{ name: SESSION_COOKIE, value: 'garbage.value', url: baseURL! }])
    await page.goto('/')
    await expect(page.getByRole('banner').getByRole('link', { name: 'Log in' })).toBeVisible()
    await page.goto('/login')
    await expect(page.getByText('Welcome back to ElevateAI.')).toBeVisible()
  })

  test('a session revoked on the server drops the UI to anonymous on window refocus', async ({ authenticatedPage: page, currentUser }) => {
    await expect(page.getByRole('button', { name: currentUser.name })).toBeVisible()
    // Revoke server-side (sign out through the API), leaving the page unaware.
    const out = await page.request.post('/api/auth/sign-out', { headers: { Origin: CLIENT_ORIGIN } })
    expect(out.status()).toBe(200)
    // react-query refetches on window focus; emulate the tab becoming visible again.
    const refetch = page.waitForResponse((r) => r.url().endsWith('/api/me'))
    await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
    expect((await refetch).status()).toBe(401)
    await expect(page.getByRole('banner').getByRole('link', { name: 'Log in' })).toBeVisible()
  })

  test('a 401 from /api/me on first load leaves the user anonymous, not stuck loading', async ({ page }) => {
    await page.route('**/api/me', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Unauthorized' } }) }),
    )
    await page.goto('/')
    await expect(page.getByRole('banner').getByRole('link', { name: 'Log in' })).toBeVisible()
  })

  test('a 500 from /api/me settles to anonymous instead of staying in the loading state', async ({ page }) => {
    await page.route('**/api/me', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Internal server error' } }) }),
    )
    await page.goto('/')
    await expect(page.getByRole('banner').getByRole('link', { name: 'Log in' })).toBeVisible()
  })

  test('a signed-in user stays signed in across client-side navigation', async ({ authenticatedPage: page, currentUser }) => {
    await page.getByRole('link', { name: 'ElevateAI' }).click()
    await expect(page.getByRole('button', { name: currentUser.name })).toBeVisible()
  })
})

test.describe('redirects', () => {
  for (const path of ['/login', '/register']) {
    test(`${path} redirects home when signed in`, async ({ authenticatedPage: page }) => {
      await page.goto(path)
      await expect(page).toHaveURL('/')
      await expect(page.getByRole('heading', { level: 1, name: /how you fit the job/i })).toBeVisible()
    })

    test(`${path} stays accessible when anonymous`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(path)
      await expect(page.getByRole('main')).toBeVisible()
    })
  }

  test('signing in on another tab does not break the anonymous tab, and a reload redirects it', async ({ page, context }) => {
    await page.goto('/login')
    const other = await context.newPage()
    await registerUser(other.request)
    await page.reload()
    await expect(page).toHaveURL('/')
  })
})
