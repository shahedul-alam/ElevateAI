import { expect, test } from 'bun:test'
import { hashContent } from '../../lib/content-hash'
import { matchEngine } from '../matching/matching.engine'
import { canonicalizeProfile } from './candidate-profile.canonical'
import { parseStoredProfile, profileContentSchema } from './candidate-profile.schema'

const parse = (raw: unknown) => profileContentSchema.parse(raw)

const base = {
  skills: [
    { termId: 'skill:react', level: 3, years: 2 },
    { termId: 'skill:typescript', level: 4, years: 3 },
  ],
  roles: [
    { title: 'Engineer', years: 3, domainId: 'domain:fintech' },
    { title: 'Intern', years: 1 },
  ],
  leadershipLevel: 1,
  certIds: ['certification:pmp', 'certification:cka'],
}

const hashOf = (raw: unknown) => hashContent(canonicalizeProfile(parse(raw)))

test('ordering of skills and certifications, and duplicates, do not change the hash', () => {
  const shuffled = {
    ...base,
    skills: [...base.skills, { termId: 'skill:react', level: 1, years: 0 }].reverse(),
    certIds: [...base.certIds, 'certification:pmp'].reverse(),
  }
  expect(hashOf(shuffled)).toBe(hashOf(base))
})

test('a real change produces a different hash', () => {
  const edited = { ...base, skills: [{ termId: 'skill:react', level: 4, years: 2 }, base.skills[1]] }
  expect(hashOf(edited)).not.toBe(hashOf(base))
})

test('decimal years are normalised before hashing', () => {
  const a = { ...base, roles: [{ title: 'Engineer', years: 2.5 }] }
  const b = { ...base, roles: [{ title: 'Engineer', years: 2.5000001 }] }
  expect(hashOf(a)).toBe(hashOf(b))
})

test('rejects ids of the wrong kind', () => {
  expect(() => parse({ ...base, certIds: ['skill:react'] })).toThrow()
})

test('the order of roles is part of the content: same order hashes equal, a different order does not', () => {
  const a = { title: 'Engineer', years: 2, company: 'Acme', description: 'Built APIs' }
  const b = { title: 'Engineer', years: 2, company: 'Beta', description: 'Ran infra' }
  expect(hashOf({ ...base, roles: [a, b] })).toBe(hashOf({ ...base, roles: [a, b] }))
  expect(hashOf({ ...base, roles: [a, b] })).not.toBe(hashOf({ ...base, roles: [b, a] }))
})

test('canonical roles and education keep the order they were given', () => {
  const roles = [
    { title: 'Zebra keeper', years: 1 },
    { title: 'Accountant', years: 2 },
  ]
  const education = [
    { degreeLevel: 3, field: 'AI' },
    { degreeLevel: 2, field: 'CS' },
  ]
  const canon = canonicalizeProfile(parse({ ...base, roles, education }))
  expect(canon.roles.map((r) => r.title)).toEqual(['Zebra keeper', 'Accountant'])
  expect(canon.education.map((e) => e.field)).toEqual(['AI', 'CS'])
})

test('the order of education entries is part of the content, but never of the score', () => {
  const x = { degreeLevel: 2, field: 'CS', institution: 'State U' }
  const y = { degreeLevel: 3, field: 'AI', institution: 'Tech U' }
  expect(hashOf({ ...base, education: [x, y] })).not.toBe(hashOf({ ...base, education: [y, x] }))

  const job = { skills: [], minYears: 0, minDomainYears: 0, minDegreeLevel: 3, leadershipLevel: 0, certIds: [] }
  const score = (education: unknown[]) =>
    matchEngine(canonicalizeProfile(parse({ ...base, education })), job)
  expect(score([x, y])).toEqual(score([y, x]))
})

test('display-only text makes a new version but never changes the score', () => {
  const plain = { ...base, summary: '', roles: [{ title: 'Engineer', years: 3 }] }
  const described = {
    ...base,
    summary: 'Backend engineer who likes data.',
    roles: [{ title: 'Engineer', years: 3, company: 'Acme', period: '2021-2024', description: 'APIs' }],
  }
  expect(hashOf(described)).not.toBe(hashOf(plain))

  const job = { skills: [], minYears: 3, minDomainYears: 0, minDegreeLevel: 0, leadershipLevel: 0, certIds: [] }
  expect(matchEngine(canonicalizeProfile(parse(described)), job)).toEqual(
    matchEngine(canonicalizeProfile(parse(plain)), job),
  )
})

test('older stored content without the newer fields is read with defaults', () => {
  const stored = parseStoredProfile({
    headline: 'Engineer',
    skills: [],
    roles: [{ title: 'Dev', years: 2 }],
    leadershipLevel: 0,
    certIds: [],
  })
  expect(stored.summary).toBe('')
  expect(stored.education).toEqual([])
  expect(stored.roles[0]!.company).toBe('')
})

test('rejects an invalid degree level', () => {
  expect(() => parse({ ...base, education: [{ degreeLevel: 5 }] })).toThrow()
  expect(() => parse({ ...base, education: [{ degreeLevel: 0 }] })).toThrow()
})
