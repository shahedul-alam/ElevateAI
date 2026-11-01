import { expect, test } from 'bun:test'
import { emptyContact, type ProfileContent } from '../profile/profile.schema'
import {
  buildResumeModel,
  formatYears,
  hasPdfUnsupportedChars,
  resumeFilename,
  resumeText,
  skillLabel,
} from './resume-model'

const content: ProfileContent = {
  headline: 'Backend engineer',
  summary: 'Builds reliable APIs.',
  skills: [
    { termId: 'skill:react', level: 3, years: 2 },
    { termId: 'skill:typescript', level: 4, years: 3 },
    { termId: 'skill:go', level: 4, years: 1 },
  ],
  roles: [
    { title: 'Staff Engineer', years: 3, domainId: 'domain:fintech', company: 'Acme', period: '2022 - present', description: 'Led the API team.' },
    { title: 'Engineer', years: 1, company: '', period: '', description: '' },
  ],
  education: [
    { degreeLevel: 2, field: 'Computer Science', institution: 'State University', period: '2014 - 2018' },
  ],
  leadershipLevel: 2,
  certIds: ['certification:pmp', 'certification:cka'],
  unmapped: ['Elixir', 'Erlang'],
  preferences: { locations: ['Secretville'], workModes: ['remote'], minSalary: 123456 },
}

const names = {
  'skill:react': 'React',
  'skill:typescript': 'TypeScript',
  'skill:go': 'Go',
  'domain:fintech': 'Fintech',
  'certification:pmp': 'PMP',
  'certification:cka': 'Certified Kubernetes Administrator',
}

const build = (overrides: Partial<Parameters<typeof buildResumeModel>[0]> = {}) =>
  buildResumeModel({
    name: 'Jane Doe',
    accountEmail: 'jane@account.test',
    content,
    contact: emptyContact,
    termNames: names,
    ...overrides,
  })

test('builds every section from a saved version', () => {
  const m = build({ contact: { ...emptyContact, phone: '+1 555 0100', city: 'Austin', country: 'USA' } })
  expect(m.name).toBe('Jane Doe')
  expect(m.headline).toBe('Backend engineer')
  expect(m.summary).toBe('Builds reliable APIs.')
  expect(m.contact).toEqual(['jane@account.test', '+1 555 0100', 'Austin, USA'])
  expect(m.education[0]).toEqual({
    heading: 'Bachelor, Computer Science',
    institution: 'State University',
    period: '2014 - 2018',
  })
  expect(m.certifications).toEqual(['Certified Kubernetes Administrator', 'PMP'])
  expect(m.additional).toEqual(['Leadership: Manager', 'Other skills: Elixir, Erlang'])
})

test('the contact email overrides the account email', () => {
  expect(build({ contact: { ...emptyContact, email: 'work@jane.test' } }).contact).toEqual(['work@jane.test'])
})

test('experience keeps the order entered and falls back to years when there are no dates', () => {
  const m = build()
  expect(m.experience.map((e) => e.title)).toEqual(['Staff Engineer', 'Engineer'])
  expect(m.experience[0]).toMatchObject({ company: 'Acme', period: '2022 - present', domain: 'Fintech' })
  expect(m.experience[1]!.period).toBe('1 yr')
})

test('skills list the highest level first, then alphabetically', () => {
  expect(build().skills.map((s) => s.name)).toEqual(['Go', 'TypeScript', 'React'])
  expect(skillLabel(build().skills[0]!)).toBe('Go (Advanced, 1 yr)')
})

test('job preferences never appear anywhere in the resume', () => {
  const text = JSON.stringify(build()) + resumeText(build()).join(' ')
  for (const secret of ['Secretville', '123456', 'remote', 'minSalary']) expect(text).not.toContain(secret)
})

test('only http(s) links are kept', () => {
  const m = build({
    contact: {
      ...emptyContact,
      linkedin: 'https://linkedin.com/in/jane',
      github: 'javascript:alert(1)',
      website: 'data:text/html,<b>x</b>',
      other: 'ftp://files.example.com',
    },
  })
  expect(m.links).toEqual([{ label: 'LinkedIn', url: 'https://linkedin.com/in/jane' }])
})

test('empty sections are left empty so renderers can skip them', () => {
  const m = build({
    content: { ...content, summary: '', skills: [], roles: [], education: [], certIds: [], unmapped: [], leadershipLevel: 0 },
  })
  expect(m.skills).toEqual([])
  expect(m.experience).toEqual([])
  expect(m.education).toEqual([])
  expect(m.certifications).toEqual([])
  expect(m.additional).toEqual([])
})

test('an unknown term id falls back to the id instead of blanking', () => {
  expect(build({ termNames: {} }).skills.map((s) => s.name).sort()).toEqual(['skill:go', 'skill:react', 'skill:typescript'])
})

test('formats years', () => {
  expect(formatYears(1)).toBe('1 yr')
  expect(formatYears(2.5)).toBe('2.5 yrs')
})

test('filenames are safe, and dated for older versions', () => {
  expect(resumeFilename('Jane Doe')).toBe('Jane-Doe-Resume.pdf')
  expect(resumeFilename('Jane Doe', '2026-11-02T09:30:00.000Z')).toBe('Jane-Doe-Resume-2026-11-02.pdf')
  expect(resumeFilename('../../etc/passwd')).toBe('etc-passwd-Resume.pdf')
  expect(resumeFilename('José Núñez')).toBe('Jose-Nunez-Resume.pdf')
  expect(resumeFilename('বাংলা')).toBe('My-Resume.pdf')
})

test('detects text the PDF font cannot draw', () => {
  expect(hasPdfUnsupportedChars(build())).toBe(false)
  expect(hasPdfUnsupportedChars(build({ name: 'José — “Núñez” – résumé • 5 €' }))).toBe(false)
  expect(hasPdfUnsupportedChars(build({ name: 'রহিম উদ্দিন' }))).toBe(true)
  expect(hasPdfUnsupportedChars(build({ content: { ...content, summary: '日本語の概要' } }))).toBe(true)
})
