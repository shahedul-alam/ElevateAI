import { expect, test } from 'bun:test'
import { hashContent } from '../../lib/content-hash'
import { canonicalizeProfile } from './candidate-profile.canonical'
import { profileContentSchema } from './candidate-profile.schema'

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

test('ordering and duplicates do not change the hash', () => {
  const shuffled = {
    ...base,
    skills: [...base.skills, { termId: 'skill:react', level: 1, years: 0 }].reverse(),
    roles: [...base.roles].reverse(),
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
