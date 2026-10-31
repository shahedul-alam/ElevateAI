import { describe, expect, test } from 'bun:test'
import { checkEligibility, matchEngine } from './matching.engine'
import type { JobContent, ProfileContent } from './matching.types'

const job: JobContent = {
  skills: [
    { termId: 'ts', required: true, minLevel: 4 },
    { termId: 'react', required: false, minLevel: 3, minYears: 2 },
  ],
  minYears: 5,
  domainId: 'fintech',
  minDomainYears: 2,
  leadershipLevel: 1,
  certIds: ['aws'],
}

const candidate: ProfileContent = {
  skills: [
    { termId: 'ts', level: 2, years: 3 },
    { termId: 'react', level: 3, years: 1 },
  ],
  roles: [
    { title: 'Engineer', years: 3, domainId: 'fintech' },
    { title: 'Intern', years: 1 },
  ],
  leadershipLevel: 0,
  certIds: [],
}

const dim = (r: ReturnType<typeof matchEngine>, key: string) =>
  r.dimensions.find((d) => d.key === key)!

describe('matchEngine golden values', () => {
  // skills: ts 2/4 = 0.5 (w2), react 0.7*1 + 0.3*0.5 = 0.85 (w1) -> (1.0 + 0.85) / 3 = 61.66% -> 62
  // experience 4/5 = 80, domain 3/2 -> 100, leadership 0/1 = 0, certs 0/1 = 0
  // overall = (40*6166 + 20*8000 + 15*10000) / 100 = 5566 bp -> 56
  test('partial match', () => {
    const r = matchEngine(candidate, job)
    expect(r.score).toBe(56)
    expect(r.engineVersion).toBe('v1')
    expect(dim(r, 'skills').score).toBe(62)
    expect(dim(r, 'experience').score).toBe(80)
    expect(dim(r, 'domain').score).toBe(100)
    expect(dim(r, 'leadership').score).toBe(0)
    expect(dim(r, 'certifications').score).toBe(0)
    expect(r.missing.skills).toEqual([
      { termId: 'react', required: false },
      { termId: 'ts', required: true },
    ])
    expect(r.missing.certs).toEqual(['aws'])
  })

  test('perfect match scores 100 with nothing missing', () => {
    const perfect: ProfileContent = {
      skills: [
        { termId: 'ts', level: 5, years: 6 },
        { termId: 'react', level: 5, years: 4 },
      ],
      roles: [{ title: 'Lead', years: 8, domainId: 'fintech' }],
      leadershipLevel: 2,
      certIds: ['aws', 'gcp'],
    }
    const r = matchEngine(perfect, job)
    expect(r.score).toBe(100)
    expect(r.missing).toEqual({ skills: [], certs: [] })
  })

  test('empty candidate scores 0', () => {
    const empty: ProfileContent = { skills: [], roles: [], leadershipLevel: 0, certIds: [] }
    expect(matchEngine(empty, job).score).toBe(0)
  })
})

describe('matchEngine dimension skipping', () => {
  test('job with no requirements matches everyone fully', () => {
    const open: JobContent = {
      skills: [],
      minYears: 0,
      minDomainYears: 0,
      leadershipLevel: 0,
      certIds: [],
    }
    const r = matchEngine(candidate, open)
    expect(r.score).toBe(100)
    expect(r.dimensions.every((d) => !d.applicable)).toBe(true)
  })

  test('unspecified dimensions renormalize instead of counting as zero', () => {
    const certsOnly: JobContent = {
      skills: [],
      minYears: 0,
      minDomainYears: 0,
      leadershipLevel: 0,
      certIds: ['aws'],
    }
    expect(matchEngine({ ...candidate, certIds: ['aws'] }, certsOnly).score).toBe(100)
    expect(matchEngine(candidate, certsOnly).score).toBe(0)
  })

  test('leadership ratio is partial', () => {
    const lead: JobContent = {
      skills: [],
      minYears: 0,
      minDomainYears: 0,
      leadershipLevel: 2,
      certIds: [],
    }
    expect(matchEngine({ ...candidate, leadershipLevel: 1 }, lead).score).toBe(50)
  })
})

describe('matchEngine reproducibility', () => {
  test('same content scores identically after an edit and revert', () => {
    const before = matchEngine(candidate, job)
    const edited = structuredClone(candidate)
    edited.skills[0]!.level = 5
    expect(matchEngine(edited, job).score).not.toBe(before.score)
    const restored = structuredClone(candidate)
    expect(matchEngine(restored, job)).toEqual(before)
  })

  test('input ordering does not change the result', () => {
    const shuffledCandidate: ProfileContent = {
      ...candidate,
      skills: [...candidate.skills].reverse(),
      roles: [...candidate.roles].reverse(),
    }
    const shuffledJob: JobContent = { ...job, skills: [...job.skills].reverse() }
    expect(matchEngine(shuffledCandidate, shuffledJob)).toEqual(matchEngine(candidate, job))
  })

  test('duplicate skill entries collapse to the strongest one', () => {
    const duplicated: ProfileContent = {
      ...candidate,
      skills: [...candidate.skills, { termId: 'ts', level: 1, years: 0 }],
    }
    expect(matchEngine(duplicated, job)).toEqual(matchEngine(candidate, job))
  })

  test('decimal years do not drift', () => {
    const j: JobContent = { ...job, skills: [], certIds: [], domainId: undefined, leadershipLevel: 0, minYears: 0.3 }
    const c: ProfileContent = {
      ...candidate,
      roles: [
        { title: 'a', years: 0.1 },
        { title: 'b', years: 0.2 },
      ],
    }
    expect(matchEngine(c, j).score).toBe(100)
  })
})

describe('matchEngine monotonicity', () => {
  test('raising a skill level never lowers the score', () => {
    let prev = -1
    for (let level = 1; level <= 5; level++) {
      const c: ProfileContent = {
        ...candidate,
        skills: candidate.skills.map((s) => (s.termId === 'ts' ? { ...s, level } : s)),
      }
      const { score } = matchEngine(c, job)
      expect(score).toBeGreaterThanOrEqual(prev)
      prev = score
    }
  })

  test('more experience years never lowers the score', () => {
    let prev = -1
    for (let years = 0; years <= 10; years++) {
      const c: ProfileContent = { ...candidate, roles: [{ title: 'x', years, domainId: 'fintech' }] }
      const { score } = matchEngine(c, job)
      expect(score).toBeGreaterThanOrEqual(prev)
      prev = score
    }
  })
})

describe('checkEligibility', () => {
  const remoteJob: JobContent = { ...job, workMode: 'remote', salaryMax: 90000 }
  const onsiteJob: JobContent = { ...job, workMode: 'onsite', location: 'Dhaka', salaryMax: 50000 }
  const prefs: ProfileContent = {
    ...candidate,
    preferences: { locations: ['dhaka'], workModes: ['remote', 'hybrid'], minSalary: 60000 },
  }

  test('remote jobs never fail location', () => {
    expect(checkEligibility(prefs, remoteJob)).toEqual({
      location: 'ok',
      workMode: 'ok',
      salary: 'ok',
    })
  })

  test('flags mismatches without touching the score', () => {
    expect(checkEligibility(prefs, onsiteJob)).toEqual({
      location: 'ok',
      workMode: 'mismatch',
      salary: 'mismatch',
    })
    expect(matchEngine(prefs, onsiteJob).score).toBe(matchEngine(candidate, onsiteJob).score)
  })

  test('missing data is unknown', () => {
    expect(checkEligibility(candidate, onsiteJob)).toEqual({
      location: 'unknown',
      workMode: 'unknown',
      salary: 'unknown',
    })
  })
})
