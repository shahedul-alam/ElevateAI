import type { Page } from '@playwright/test'
import { ADMIN, registerUser } from './support/auth'
import { expect, publishJobWith, test } from './support/company'

const main = (page: Page) => page.getByRole('main')
const footer = (page: Page) => page.getByRole('contentinfo')

test.describe('landing page, signed out', () => {
  test('shows the hero with sign-up and browse links, and only public nav links', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Know exactly how you fit the job')

    const hero = main(page).locator('section').first()
    await expect(hero.getByRole('link', { name: 'Create your profile' })).toHaveAttribute('href', '/register')
    await expect(hero.getByRole('link', { name: 'Browse jobs' })).toHaveAttribute('href', '/jobs')

    const banner = page.getByRole('banner')
    await expect(banner.getByRole('link', { name: 'Jobs', exact: true })).toBeVisible()
    await expect(banner.getByRole('link', { name: 'Companies', exact: true })).toBeVisible()
    for (const name of ['Resume', 'Applications', 'Dashboard']) {
      await expect(banner.getByRole('link', { name, exact: true })).toHaveCount(0)
    }
  })

  test('"How it works" steps send guests to sign-up or the public job list', async ({ page }) => {
    await page.goto('/')
    const steps = main(page).getByRole('listitem').filter({ has: page.getByRole('heading', { level: 3 }) })
    await expect(steps).toHaveCount(3)

    await expect(steps.nth(0).getByRole('link', { name: /Create an account/ })).toHaveAttribute('href', '/register')
    await expect(steps.nth(1).getByRole('link', { name: /Browse jobs/ })).toHaveAttribute('href', '/jobs')
    await expect(steps.nth(2).getByRole('link', { name: /Create an account/ })).toHaveAttribute('href', '/register')
  })

  test('footer links guests to sign-up and shows Log in', async ({ page }) => {
    await page.goto('/')
    await expect(footer(page).getByRole('link', { name: 'Resume builder' })).toHaveAttribute('href', '/register')
    await expect(footer(page).getByRole('link', { name: 'Post a job' })).toHaveAttribute('href', '/register')
    await expect(footer(page).getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
  })
})

test.describe('landing page, signed in', () => {
  test('candidate gets the dashboard CTA and the resume step', async ({ page }) => {
    await registerUser(page.request, { role: 'candidate' })
    await page.goto('/')

    const hero = main(page).locator('section').first()
    await expect(hero.getByRole('link', { name: 'Open your dashboard' })).toHaveAttribute('href', '/dashboard')
    await expect(main(page).getByRole('link', { name: /Start your profile/ })).toHaveAttribute('href', '/resume')
    await expect(footer(page).getByRole('link', { name: 'Resume builder' })).toHaveAttribute('href', '/resume')
    await expect(footer(page).getByRole('link', { name: 'Log in' })).toHaveCount(0)

    await hero.getByRole('link', { name: 'Open your dashboard' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('employer gets the post-a-job CTA and no candidate step link', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    await page.goto('/')

    const hero = main(page).locator('section').first()
    await expect(hero.getByRole('link', { name: 'Post a job' })).toHaveAttribute('href', '/employer/jobs/new')
    await expect(main(page).getByRole('link', { name: /Start your profile/ })).toHaveCount(0)
    await expect(footer(page).getByRole('link', { name: 'Post a job' })).toHaveAttribute('href', '/employer/jobs/new')
    await expect(footer(page).getByRole('link', { name: 'Log in' })).toHaveCount(0)
  })

  test('admin gets the open-admin CTA', async ({ page }) => {
    const res = await page.request.post('/api/auth/login', { data: ADMIN })
    expect(res.status(), await res.text()).toBe(200)
    await page.goto('/')

    const hero = main(page).locator('section').first()
    await hero.getByRole('link', { name: 'Open admin' }).click()
    await expect(page).toHaveURL(/\/admin$/)
  })
})

test.describe('landing page content', () => {
  test('lists a freshly published job under Latest openings and links to it', async ({ page, newEmployer }) => {
    const employer = await newEmployer()
    const job = await publishJobWith(employer.api)

    await page.goto('/')
    await expect(main(page).getByRole('heading', { name: 'Latest openings' })).toBeVisible()
    await main(page).getByRole('link', { name: job.title }).first().click()
    await expect(page).toHaveURL(new RegExp(`/jobs/${job.id}$`))
  })

  test('FAQ answers expand and collapse from the keyboard', async ({ page }) => {
    await page.goto('/')
    const question = main(page).getByText('Will my score change after I apply?')
    const answer = main(page).getByText('The score, your resume version and the job version are frozen')
    await expect(answer).toBeHidden()

    await question.focus()
    await page.keyboard.press('Enter')
    await expect(answer).toBeVisible()

    await page.keyboard.press('Enter')
    await expect(answer).toBeHidden()
  })

  test('AI privacy notice link in the footer opens /privacy', async ({ page }) => {
    await page.goto('/')
    await footer(page).getByRole('link', { name: 'AI privacy notice' }).click()
    await expect(page).toHaveURL(/\/privacy$/)
  })
})
