import { expect, test, type APIRequestContext, type Page, type Playwright } from '@playwright/test'
import { registerUser } from './support/auth'
import { uniqueCompanyName } from './support/company'
import { applyApi, publishReactJob, reactProfile, setStatus } from './support/matching'
import { uniqueTitle } from './support/jobs'
import { saveProfileApi } from './support/profile'

/**
 * One candidate with four applications, scored 50 (Frontend), 100 (Backend), 40 (Platform) and 67 (Data),
 * applied in that order, and moved to four different stages. Frontend and Platform and Data are at
 * "Orbit Labs"; Backend is at another company.
 */
async function setup(page: Page, playwright: Playwright, baseURL: string | undefined) {
  const tag = uniqueTitle('Apps')
  const companyA = uniqueCompanyName('Orbit Labs')
  const companyB = uniqueCompanyName('Other Co')
  const orbit = await employerContext(playwright, baseURL, companyA)
  const other = await employerContext(playwright, baseURL, companyB)

  const titles = {
    frontend: `${tag} Frontend`,
    backend: `${tag} Backend`,
    platform: `${tag} Platform`,
    data: `${tag} Data`,
  }
  const frontendJob = await publishReactJob(orbit, 4, { title: titles.frontend })
  const backendJob = await publishReactJob(other, 2, { title: titles.backend })
  const platformJob = await publishReactJob(orbit, 5, { title: titles.platform })
  const dataJob = await publishReactJob(orbit, 3, { title: titles.data })

  await registerUser(page.request, { role: 'candidate' })
  await saveProfileApi(page.request, reactProfile(2))
  const frontend = await applyApi(page.request, frontendJob.id)
  const backend = await applyApi(page.request, backendJob.id)
  const platform = await applyApi(page.request, platformJob.id)
  const data = await applyApi(page.request, dataJob.id)

  await setStatus(orbit, frontend.id, 'under_review')
  await setStatus(other, backend.id, 'under_review')
  await setStatus(other, backend.id, 'technical_interview')
  await setStatus(orbit, data.id, 'rejected')

  const cleanup = async () => {
    await orbit.dispose()
    await other.dispose()
  }
  return {
    tag,
    titles,
    companyA,
    cleanup,
    // Default order: newest application first.
    newestFirst: [titles.data, titles.platform, titles.backend, titles.frontend],
    oldestFirst: [titles.frontend, titles.backend, titles.platform, titles.data],
    bestMatch: [titles.backend, titles.data, titles.frontend, titles.platform],
    atOrbitNewestFirst: [titles.data, titles.platform, titles.frontend],
  }
}

async function employerContext(playwright: Playwright, baseURL: string | undefined, companyName: string) {
  const ctx: APIRequestContext = await playwright.request.newContext({ baseURL })
  // An employer's company is created with the account name, so this name is the company name.
  await registerUser(ctx, { role: 'employer', name: companyName })
  return ctx
}

test.describe('candidate applications page', () => {
  test('searches by job title and by company name, ignoring case', async ({ page, playwright, baseURL }) => {
    const s = await setup(page, playwright, baseURL)
    await page.goto('/applications')
    const search = page.getByRole('searchbox', { name: 'Search your applications' })
    const list = page.getByRole('main').getByRole('link', { name: s.tag })
    await expect(list).toHaveText(s.newestFirst)

    await search.fill('BACKEND')
    await expect(page).toHaveURL(/q=BACKEND/)
    await expect(list).toHaveText([s.titles.backend])

    await search.fill(s.companyA.toUpperCase())
    await expect(list).toHaveText(s.atOrbitNewestFirst)

    await search.fill('')
    await expect(list).toHaveText(s.newestFirst)
    await expect(page).toHaveURL(/\/applications$/)

    await s.cleanup()
  })

  test('filters by status, and the counts stay the same while typing in search', async ({
    page,
    playwright,
    baseURL,
  }) => {
    const s = await setup(page, playwright, baseURL)
    await page.goto('/applications')
    const list = page.getByRole('main').getByRole('link', { name: s.tag })
    const all = page.getByRole('button', { name: 'All (4)', exact: true })
    await expect(all).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Applied (1)', exact: true })).toHaveAttribute('aria-pressed', 'false')

    await page.getByRole('button', { name: 'Under review (1)', exact: true }).click()
    await expect(page).toHaveURL(/status=under_review/)
    await expect(page.getByRole('button', { name: 'Under review (1)', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(all).toHaveAttribute('aria-pressed', 'false')
    await expect(list).toHaveText([s.titles.frontend])

    await all.click()
    await expect(page).not.toHaveURL(/status=/)
    await page.getByRole('searchbox', { name: 'Search your applications' }).fill('Backend')
    await expect(list).toHaveText([s.titles.backend])
    // Counts cover every stage and ignore the search text.
    await expect(all).toBeVisible()
    await expect(page.getByRole('button', { name: 'Under review (1)', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Technical interview (1)', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rejected (1)', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Rejected (1)', exact: true }).click()
    await expect(page).toHaveURL(/status=rejected/)
    await expect(page.getByRole('searchbox', { name: 'Search your applications' })).toHaveValue('Backend')
    await expect(page.getByText('No applications match your filters.')).toBeVisible()

    await s.cleanup()
  })

  test('sorts newest first by default, then oldest first, then best match', async ({ page, playwright, baseURL }) => {
    const s = await setup(page, playwright, baseURL)
    await page.goto('/applications')
    const list = page.getByRole('main').getByRole('link', { name: s.tag })
    const sort = page.getByLabel('Sort applications')
    await expect(sort).toHaveValue('newest')
    await expect(list).toHaveText(s.newestFirst)

    await sort.selectOption({ label: 'Oldest first' })
    await expect(page).toHaveURL(/sort=oldest/)
    await expect(list).toHaveText(s.oldestFirst)

    await sort.selectOption({ label: 'Best match' })
    await expect(page).toHaveURL(/sort=match/)
    await expect(list).toHaveText(s.bestMatch)

    await sort.selectOption({ label: 'Newest first' })
    await expect(page).not.toHaveURL(/sort=/)
    await expect(list).toHaveText(s.newestFirst)

    await s.cleanup()
  })

  test('mirrors the filters in the URL and restores them after a reload', async ({ page, playwright, baseURL }) => {
    const s = await setup(page, playwright, baseURL)
    await page.goto('/applications')
    const search = page.getByRole('searchbox', { name: 'Search your applications' })
    const list = page.getByRole('main').getByRole('link', { name: s.tag })

    await search.fill(s.companyA)
    await page.getByLabel('Sort applications').selectOption({ label: 'Oldest first' })
    await expect(page).toHaveURL(/sort=oldest/)
    await expect(page).toHaveURL(/q=Orbit/)
    await expect(list).toHaveText([s.titles.frontend, s.titles.platform, s.titles.data])

    await page.reload()
    await expect(search).toHaveValue(s.companyA)
    await expect(page.getByLabel('Sort applications')).toHaveValue('oldest')
    await expect(page.getByRole('button', { name: 'All (4)', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(list).toHaveText([s.titles.frontend, s.titles.platform, s.titles.data])

    await s.cleanup()
  })

  test('opens with the status and sort from the URL applied', async ({ page, playwright, baseURL }) => {
    const s = await setup(page, playwright, baseURL)
    await page.goto('/applications?status=under_review&sort=oldest')
    await expect(page.getByRole('button', { name: 'Under review (1)', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Sort applications')).toHaveValue('oldest')
    await expect(page.getByRole('main').getByRole('link', { name: s.tag })).toHaveText([s.titles.frontend])

    await s.cleanup()
  })

  test('falls back to the defaults for an invalid status or sort in the URL', async ({ page, playwright, baseURL }) => {
    const s = await setup(page, playwright, baseURL)
    await page.goto('/applications?status=bogus&sort=sideways')
    await expect(page.getByRole('button', { name: 'All (4)', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Sort applications')).toHaveValue('newest')
    await expect(page.getByRole('main').getByRole('link', { name: s.tag })).toHaveText(s.newestFirst)

    await s.cleanup()
  })

  test('shows a no-match message, and Clear filters resets search, status and sort', async ({
    page,
    playwright,
    baseURL,
  }) => {
    const s = await setup(page, playwright, baseURL)
    await page.goto('/applications')
    const search = page.getByRole('searchbox', { name: 'Search your applications' })
    const sort = page.getByLabel('Sort applications')
    const list = page.getByRole('main').getByRole('link', { name: s.tag })

    await page.getByRole('button', { name: 'Rejected (1)', exact: true }).click()
    await search.fill('Backend')
    await sort.selectOption({ label: 'Oldest first' })
    await expect(page.getByText('No applications match your filters.')).toBeVisible()

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.getByText('No applications match your filters.')).toBeHidden()
    await expect(search).toHaveValue('')
    await expect(sort).toHaveValue('newest')
    await expect(page.getByRole('button', { name: 'All (4)', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page).toHaveURL(/\/applications$/)
    await expect(list).toHaveText(s.newestFirst)

    await s.cleanup()
  })

  test('a candidate with no applications sees the empty message and no filter controls', async ({ page }) => {
    await registerUser(page.request, { role: 'candidate' })
    await page.goto('/applications')
    await expect(page.getByText('You have not applied to any jobs yet.')).toBeVisible()
    await expect(page.getByRole('searchbox', { name: 'Search your applications' })).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Filter by status' })).toHaveCount(0)
    await expect(page.getByLabel('Sort applications')).toHaveCount(0)
  })

  test('employers do not see the filters', async ({ page }) => {
    await registerUser(page.request, { role: 'employer' })
    await page.goto('/applications')
    await expect(page.getByText('Applications are for candidate accounts.')).toBeVisible()
    await expect(page.getByRole('searchbox', { name: 'Search your applications' })).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Filter by status' })).toHaveCount(0)
    await expect(page.getByLabel('Sort applications')).toHaveCount(0)
  })
})
