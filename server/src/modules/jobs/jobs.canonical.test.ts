import { expect, test } from 'bun:test'
import { hashContent } from '../../lib/content-hash'
import { canonicalizeJob, hasScoredRequirement } from './jobs.canonical'
import { jobContentSchema } from './jobs.schema'

const parse = (raw: unknown) => jobContentSchema.parse(raw)

const base = {
  title: 'Backend engineer',
  description: 'Build APIs.',
  skills: [
    { termId: 'skill:typescript', required: true, minLevel: 4 },
    { termId: 'skill:postgresql', required: false, minLevel: 3, minYears: 2 },
  ],
  minYears: 3,
  minDomainYears: 0,
  leadershipLevel: 0,
  certIds: ['certification:pmp', 'certification:cka'],
}

const hashOf = (raw: unknown) => hashContent(canonicalizeJob(parse(raw)))

test('ordering and duplicate skills do not change the hash', () => {
  const shuffled = {
    ...base,
    skills: [
      ...base.skills,
      { termId: 'skill:typescript', required: false, minLevel: 2 },
    ].reverse(),
    certIds: [...base.certIds].reverse(),
  }
  expect(hashOf(shuffled)).toBe(hashOf(base))
})

test('duplicates keep the strictest requirement', () => {
  const merged = canonicalizeJob(
    parse({
      ...base,
      skills: [
        { termId: 'skill:go', required: false, minLevel: 2 },
        { termId: 'skill:go', required: true, minLevel: 4, minYears: 3 },
      ],
    }),
  )
  expect(merged.skills).toEqual([{ termId: 'skill:go', required: true, minLevel: 4, minYears: 3 }])
})

test('a real change produces a different hash', () => {
  expect(hashOf({ ...base, minYears: 4 })).not.toBe(hashOf(base))
})

test('rejects a salary range where max is below min', () => {
  expect(() => parse({ ...base, salaryMin: 90000, salaryMax: 50000 })).toThrow()
})

test('rejects ids of the wrong kind', () => {
  expect(() => parse({ ...base, domainId: 'skill:react' })).toThrow()
})

test('a post with no scored requirement cannot be published', () => {
  const empty = parse({ ...base, skills: [], minYears: 0, certIds: [] })
  expect(hasScoredRequirement(empty)).toBe(false)
  expect(hasScoredRequirement(parse(base))).toBe(true)
  expect(hasScoredRequirement(parse({ ...empty, leadershipLevel: 1 }))).toBe(true)
})
