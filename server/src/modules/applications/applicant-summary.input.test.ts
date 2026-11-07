import { expect, test } from 'bun:test'
import type { ProfileInput } from '../candidate-profile/candidate-profile.schema'
import { buildSummaryInput, cleanSummary } from './applicant-summary.input'

const profile = {
  headline: 'Backend engineer',
  summary: 'Reach me at jane@example.com or +44 20 7946 0958, see https://jane.dev. Builds APIs.',
  skills: [{ termId: 'skill:node', level: 4, years: 6 }],
  roles: [
    {
      title: 'Engineer',
      years: 6,
      domainId: 'domain:fintech',
      company: 'SECRET-COMPANY',
      period: 'SECRET-2015-2021',
      description: 'Built payment APIs. Contact hr@secret.org',
    },
  ],
  education: [{ degreeLevel: 3, field: 'Physics', institution: 'SECRET-UNIVERSITY', period: 'SECRET-2010' }],
  leadershipLevel: 1,
  certIds: ['certification:aws'],
  unmapped: ['SECRET-UNMAPPED'],
  preferences: { locations: ['SECRET-CITY'], workModes: ['remote'], minSalary: 987654 },
} as unknown as ProfileInput

const names = { 'skill:node': 'Node.js', 'domain:fintech': 'Fintech', 'certification:aws': 'AWS Certified' }

test('the model input leaves out names, contact, companies, schools, dates and preferences', () => {
  const input = buildSummaryInput(profile, names)
  const text = JSON.stringify(input)
  for (const secret of ['SECRET', 'jane@example.com', 'hr@secret.org', '7946', 'jane.dev', '987654']) {
    expect(text).not.toContain(secret)
  }
  expect(input.skills).toEqual([{ name: 'Node.js', level: 'Advanced', years: 6 }])
  expect(input.roles[0]).toEqual({ title: 'Engineer', years: 6, industry: 'Fintech', description: 'Built payment APIs. Contact' })
  expect(input.education).toEqual([{ degree: 'Master', field: 'Physics' }])
  expect(input.certifications).toEqual(['AWS Certified'])
  expect(input.leadership).toBe('Team lead')
})

test('cleanSummary strips emails, links and phone numbers and caps the length', () => {
  const out = cleanSummary('Strong   in Node. Email a@b.co or call 020 7946 0958, visit www.x.dev now.')
  expect(out).not.toMatch(/@|www|7946/)
  expect(out.startsWith('Strong in Node.')).toBe(true)
  expect(cleanSummary('x'.repeat(900))).toHaveLength(600)
})
