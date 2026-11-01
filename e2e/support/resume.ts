import { expect, type Page } from '@playwright/test'
import { extractText, getDocumentProxy } from 'unpdf'
import type { Contact, ProfileContent } from './profile'
import { profileContent } from './profile'

/** Strings that belong to job preferences only: they must never reach a resume or its PDF. */
export const PRIVATE = { minSalary: 987654, location: 'Reykjavik-Private', workMode: 'remote' }

export const CONTACT: Partial<Contact> = {
  phone: '+1 555 010 4242',
  email: 'resume.contact@example.com',
  city: 'Toronto',
  country: 'Canada',
  linkedin: 'https://www.linkedin.com/in/resume-person',
  github: 'https://github.com/resume-person',
  website: 'https://resume-person.example.com/work',
  other: 'http://example.org/resume-other',
}

/** A resume that touches every section. Role order is deliberately not alphabetical. */
export function fullResume(token: string): ProfileContent {
  return profileContent({
    contact: CONTACT,
    headline: `Platform engineer ${token}`,
    summary: `Summary line for ${token}.`,
    skills: [
      { termId: 'skill:react', level: 3, years: 2 },
      { termId: 'skill:python', level: 5, years: 6 },
      { termId: 'skill:typescript', level: 3, years: 1 },
    ],
    roles: [
      {
        title: `Zeta Lead ${token}`,
        company: 'Zeta Corp',
        period: 'Jan 2022 - Mar 2024',
        years: 2,
        description: `Led the zeta platform ${token}`,
        domainId: 'domain:fintech',
      },
      { title: `Alpha Developer ${token}`, company: 'Alpha Inc', period: '2019 - 2021', years: 2, description: 'Built alpha things' },
      { title: `Mid Analyst ${token}`, years: 1 },
    ],
    education: [
      { degreeLevel: 3, field: 'Artificial Intelligence', institution: 'Tech Institute', period: '2019 - 2021' },
      { degreeLevel: 2, field: 'Computer Science', institution: 'State University', period: '2015 - 2019' },
    ],
    leadershipLevel: 2,
    certIds: ['certification:aws-solutions-architect', 'certification:aws-developer'],
    unmapped: ['Bash scripting', 'Kanban'],
    preferences: { locations: [PRIVATE.location], workModes: [PRIVATE.workMode], minSalary: PRIVATE.minSalary },
  })
}

/** Collapses whitespace so text can be matched regardless of how the PDF wraps or spaces it. */
export const squash = (text: string) => text.replace(/\s+/g, ' ').trim()

export async function pdfText(buffer: Buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text } = await extractText(pdf, { mergePages: true })
  return squash(text)
}

/** Asserts each needle appears in the haystack, and in the given order. */
export function expectInOrder(haystack: string, needles: string[]) {
  let from = 0
  for (const needle of needles) {
    const at = haystack.indexOf(needle, from)
    expect(at, `"${needle}" should appear after position ${from}`).toBeGreaterThanOrEqual(0)
    from = at + needle.length
  }
}

/** Clicks "Download PDF" and returns the downloaded file name and bytes. */
export async function downloadPdf(page: Page) {
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PDF' }).click()
  const download = await downloadPromise
  const path = await download.path()
  const { readFile } = await import('node:fs/promises')
  return { filename: download.suggestedFilename(), bytes: await readFile(path) }
}

/** Collects uncaught page errors and console errors, to assert on at the end of a test. */
export function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  return errors
}

/**
 * Section headings are upper-cased and letter-spaced in the PDF, so the extracted text can read
 * "S U M M A RY". Matches each heading with optional spaces between letters, in order.
 */
export function expectHeadingsInOrder(haystack: string, headings: string[]) {
  let from = 0
  for (const heading of headings) {
    const pattern = new RegExp([...heading.toUpperCase()].join(' ?'))
    const match = pattern.exec(haystack.slice(from))
    expect(match, `heading "${heading}" should appear after position ${from}`).not.toBeNull()
    from += match!.index + match![0].length
  }
}
