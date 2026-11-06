import { expect, test as base, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { ADMIN, registerUser, type TestUser } from './auth'
import { createJobApi, jobAction, jobContent } from './jobs'

export type CompanyDto = {
  id: string
  name: string
  tagline: string
  about: string
  mission: string
  headquarters: string
  size: string
  fundingStage: string
  foundedYear: number | null
  website: string
  links: { linkedin: string; github: string; x: string }
  culture: { title: string; description: string }[]
  benefits: string[]
  hubs: string[]
  awards: { title: string; issuer: string; year: number | null }[]
  domainId: string | null
  workPolicy: 'onsite' | 'hybrid' | 'remote_first' | null
  verified: boolean
  logoUrl: string | null
  coverUrl: string | null
}

export type EmployerSetup = {
  /** A separate API context, signed in as this employer. */
  api: APIRequestContext
  user: TestUser
  company: CompanyDto
}

let counter = 0

/** Two words first so the generated logo initials are predictable ("OL"). */
export function uniqueCompanyName(prefix = 'Orbit Labs') {
  counter += 1
  return `${prefix} ${Date.now().toString(36)}${counter}${Math.random().toString(36).slice(2, 5)}`
}

/** A fully filled, valid company payload. */
export function companyPayload(name: string, overrides: Record<string, unknown> = {}) {
  return {
    name,
    tagline: 'Building the future of hiring',
    about: 'We are a small team that cares about craft.',
    mission: 'Make hiring fair for everyone.',
    headquarters: 'Dhaka, Bangladesh',
    size: '51-200',
    fundingStage: 'Series A',
    foundedYear: 2015,
    website: 'https://example.com',
    links: {
      linkedin: 'https://www.linkedin.com/company/example',
      github: 'https://github.com/example',
      x: 'https://x.com/example',
    },
    culture: [{ title: 'Radical ownership', description: 'Own the outcome' }],
    benefits: ['Health insurance', 'Learning budget'],
    hubs: ['London, UK', 'Remote EU'],
    awards: [{ title: 'Best Places to Work', issuer: 'Workplace Weekly', year: 2022 }],
    domainId: 'domain:saas',
    workPolicy: 'hybrid',
    ...overrides,
  }
}

export async function getMyCompany(api: APIRequestContext) {
  const res = await api.get('/api/employer/company')
  expect(res.status(), await res.text()).toBe(200)
  return (await res.json()).company as CompanyDto
}

/** PUT as given (no assertion), for tests that expect a failure. */
export const putCompany = (api: APIRequestContext, payload: Record<string, unknown>) =>
  api.put('/api/employer/company', { data: payload })

export async function saveCompany(api: APIRequestContext, payload: Record<string, unknown>) {
  const res = await putCompany(api, payload)
  expect(res.status(), await res.text()).toBe(200)
  return (await res.json()).company as CompanyDto
}

/** Re-saves the stored profile with some fields changed (the PUT replaces everything). */
export async function updateCompany(api: APIRequestContext, overrides: Record<string, unknown>) {
  const current = await getMyCompany(api)
  const { id, verified, logoUrl, coverUrl, ...editable } = current
  void id
  void verified
  void logoUrl
  void coverUrl
  return saveCompany(api, { ...editable, ...overrides })
}

export async function setVerified(admin: APIRequestContext, companyId: string, verified: boolean) {
  const res = await admin.patch(`/api/admin/companies/${companyId}/verification`, { data: { verified } })
  expect(res.status(), await res.text()).toBe(200)
}

export async function getPublicCompany(request: APIRequestContext, id: string) {
  const res = await request.get(`/api/companies/${id}`)
  expect(res.status(), await res.text()).toBe(200)
  return (await res.json()) as { company: CompanyDto; jobs: { id: string; title: string }[] }
}

/** Creates a job and publishes it. `extra` carries display-only fields such as applicationDeadline. */
export async function publishJobWith(api: APIRequestContext, extra: Record<string, unknown> = {}) {
  const content = { ...jobContent(), ...extra }
  const created = await api.post('/api/employer/jobs', { data: content })
  expect(created.status(), await created.text()).toBe(201)
  const job = (await created.json()).job as { id: string }
  const published = await jobAction(api, job.id, 'publish')
  expect(published.status(), await published.text()).toBe(200)
  return { id: job.id, title: content.title }
}

export async function closedJob(api: APIRequestContext) {
  const job = await createJobApi(api)
  expect((await jobAction(api, job.id, 'publish')).status()).toBe(200)
  expect((await jobAction(api, job.id, 'close')).status()).toBe(200)
  return job
}

// ---- image fixtures ----------------------------------------------------------------------------

export { jpegImage, pngImage, pngOfSize, webpImage } from './images'

export const uploadImage = (
  api: APIRequestContext,
  kind: string,
  body: Buffer,
  contentType = 'image/png',
) => api.put(`/api/employer/company/${kind}`, { data: body, headers: { 'Content-Type': contentType } })

// ---- fixtures ----------------------------------------------------------------------------------

type Fixtures = {
  /** Registers an employer in its own API context (disposed after the test). */
  newEmployer: (opts?: { name?: string }) => Promise<EmployerSetup>
  /** Registers a candidate in its own API context. */
  newCandidate: (opts?: { name?: string }) => Promise<{ api: APIRequestContext; user: TestUser }>
  /** The seeded e2e admin, signed in through the API. */
  adminApi: APIRequestContext
}

export const test = base.extend<Fixtures>({
  newEmployer: async ({ playwright, baseURL }, use) => {
    const contexts: APIRequestContext[] = []
    await use(async (opts = {}) => {
      const api = await playwright.request.newContext({ baseURL })
      contexts.push(api)
      const user = await registerUser(api, { role: 'employer', name: opts.name ?? uniqueCompanyName() })
      return { api, user, company: await getMyCompany(api) }
    })
    await Promise.all(contexts.map((c) => c.dispose()))
  },
  newCandidate: async ({ playwright, baseURL }, use) => {
    const contexts: APIRequestContext[] = []
    await use(async (opts = {}) => {
      const api = await playwright.request.newContext({ baseURL })
      contexts.push(api)
      const user = await registerUser(api, { role: 'candidate', name: opts.name ?? uniqueCompanyName('Cara Candidate') })
      return { api, user }
    })
    await Promise.all(contexts.map((c) => c.dispose()))
  },
  adminApi: async ({ playwright, baseURL }, use) => {
    const api = await playwright.request.newContext({ baseURL })
    const res = await api.post('/api/auth/login', { data: ADMIN })
    expect(res.status(), await res.text()).toBe(200)
    await use(api)
    await api.dispose()
  },
})

export { expect } from '@playwright/test'

// ---- UI helpers --------------------------------------------------------------------------------

type Credentials = { email: string; password: string; name: string }

/** The card (shadcn Card) that holds the given title. */
export const cardOf = (page: Page, title: string): Locator =>
  page.locator('[data-slot="card"]').filter({ has: page.getByText(title, { exact: true }) })

/** Signs in through the navbar link, so the single-page app (and its caches) is never reloaded. */
export async function signInUi(page: Page, user: Credentials) {
  if (page.url() === 'about:blank') await page.goto('/')
  await page.getByRole('banner').getByRole('link', { name: 'Log in' }).click()
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('banner').getByRole('button', { name: user.name, exact: true })).toBeVisible()
}

export async function signOutUi(page: Page, user: Pick<Credentials, 'name'>) {
  const done = page.waitForResponse((r) => r.url().includes('/api/auth/sign-out'))
  await page.getByRole('banner').getByRole('button', { name: user.name, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await done
  await expect(page.getByRole('banner').getByRole('link', { name: 'Log in' })).toBeVisible()
}

/** Opens a company page by clicking through Companies > search > card (no page reload). */
export async function openCompanyViaNav(page: Page, name: string) {
  await page.getByRole('banner').getByRole('link', { name: 'Companies', exact: true }).click()
  await page.getByLabel('Search companies').fill(name)
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('main').getByRole('link', { name }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}
