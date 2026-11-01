import { expect, type APIRequestContext, type Page } from '@playwright/test'

export type ProfileSkill = { termId: string; level: number; years: number }

export type Contact = {
  phone: string
  email: string
  city: string
  country: string
  linkedin: string
  github: string
  website: string
  other: string
}

export const EMPTY_CONTACT: Contact = {
  phone: '',
  email: '',
  city: '',
  country: '',
  linkedin: '',
  github: '',
  website: '',
  other: '',
}

/** Contact is optional on save: leaving it out keeps what is stored. */
export type ProfileContent = {
  contact?: Partial<Contact>
  headline: string
  summary?: string
  skills: ProfileSkill[]
  roles: {
    title: string
    years: number
    domainId?: string
    company?: string
    period?: string
    description?: string
  }[]
  education?: { degreeLevel: number; field?: string; institution?: string; period?: string }[]
  leadershipLevel: number
  certIds: string[]
  unmapped: string[]
  preferences: { locations: string[]; workModes: string[]; minSalary?: number }
}

export function profileContent(overrides: Partial<ProfileContent> = {}): ProfileContent {
  return {
    headline: 'E2E engineer',
    skills: [{ termId: 'skill:react', level: 3, years: 2 }],
    roles: [{ title: 'Developer', years: 2, domainId: 'domain:fintech' }],
    leadershipLevel: 0,
    certIds: [],
    unmapped: [],
    preferences: { locations: [], workModes: [] },
    ...overrides,
  }
}

type Version = { id: string; createdAt: string; isCurrent: boolean; content: ProfileContent }

export async function saveProfileApi(request: APIRequestContext, content: ProfileContent) {
  const res = await request.put('/api/candidate/profile', { data: content })
  expect(res.status(), await res.text()).toBe(200)
  return (await res.json()).profile as Version
}

export async function getProfileApi(request: APIRequestContext) {
  const res = await request.get('/api/candidate/profile')
  expect(res.status(), await res.text()).toBe(200)
  return (await res.json()).profile as Version & { contact: Contact }
}

export async function listVersionsApi(request: APIRequestContext) {
  const res = await request.get('/api/candidate/profile/versions')
  expect(res.status()).toBe(200)
  return (await res.json()).versions as Version[]
}

/** Picks a catalog term from a picker's dropdown by typing and clicking the option. */
export async function pickTerm(page: Page, placeholder: string, query: string, name: string) {
  const input = page.getByPlaceholder(placeholder)
  await input.click()
  await input.fill(query)
  await page.getByRole('button', { name, exact: true }).click()
}

export async function saveResume(page: Page) {
  const saved = page.waitForResponse(
    (r) => r.url().endsWith('/api/candidate/profile') && r.request().method() === 'PUT',
  )
  await page.getByRole('button', { name: 'Save resume' }).click()
  expect((await saved).status()).toBe(200)
  await expect(page.getByRole('button', { name: 'Save resume' })).toBeEnabled()
}
