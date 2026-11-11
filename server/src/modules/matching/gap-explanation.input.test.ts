import { expect, test } from 'bun:test'
import type { ProfileInput } from '../candidate-profile/candidate-profile.schema'
import type { JobInput } from '../jobs/jobs.schema'
import { buildExplainInput, cleanExplanation } from './gap-explanation.input'

const names = { 'skill:react': 'React', 'skill:docker': 'Docker', 'certification:aws': 'AWS Certified', 'domain:fintech': 'Fintech' }

const profile = {
  headline: 'SECRET-HEADLINE',
  summary: 'SECRET-SUMMARY',
  skills: [{ termId: 'skill:react', level: 4, years: 5 }],
  roles: [{ title: 'SECRET-ROLE-TITLE', years: 5, company: 'SECRET-COMPANY', period: '', description: 'SECRET-ROLE-TEXT' }],
  education: [{ degreeLevel: 2, field: 'CS', institution: 'SECRET-UNI', period: '' }],
  leadershipLevel: 1,
  certIds: [],
  unmapped: ['SECRET-OTHER'],
  preferences: { locations: ['SECRET-CITY'], workModes: ['remote'], minSalary: 987654 },
} as unknown as ProfileInput

const job = {
  title: 'Platform Engineer',
  description: 'job text',
  skills: [
    { termId: 'skill:react', required: true, minLevel: 3 },
    { termId: 'skill:docker', required: false, minLevel: 2, minYears: 2 },
  ],
  minYears: 3,
  domainId: 'domain:fintech',
  minDomainYears: 0,
  minDegreeLevel: 2,
  leadershipLevel: 0,
  certIds: ['certification:aws'],
} as unknown as JobInput

const gap = {
  score: 61,
  dimensions: [
    { key: 'skills' as const, score: 50, applicable: true },
    { key: 'leadership' as const, score: 0, applicable: false },
  ],
  eligibility: { location: 'ok', workMode: 'mismatch', salary: 'unknown' } as never,
  missing: { skills: [{ name: 'Docker', required: false }], certs: [{ name: 'AWS Certified' }] },
}

test('the model input has names, levels and numbers but no private or free-text profile data', () => {
  const input = buildExplainInput(gap, job, profile, names)
  const text = JSON.stringify(input)
  expect(text).not.toContain('SECRET')
  expect(text).not.toContain('987654')
  expect(input.candidate.skills).toEqual([{ name: 'React', level: 'Advanced', years: 5 }])
  expect(input.candidate.highestDegree).toBe('Bachelor')
  expect(input.job.requiredSkills[0]).toEqual({ name: 'React', minLevel: 'Intermediate', minYears: undefined })
  expect(input.job.preferredSkills[0]).toEqual({ name: 'Docker', minLevel: 'Basic', minYears: 2 })
  expect(input.areaScores).toEqual([{ area: 'Skills', score: 50 }])
  expect(input.missingSkills).toEqual([{ name: 'Docker', required: false }])
})

test('cleanExplanation trims and drops empty steps', () => {
  const out = cleanExplanation({
    summary: '  You fit well.  ',
    steps: [
      { focus: ' Docker ', action: ' Build a small project. ' },
      { focus: '', action: 'x' },
      { focus: 'AWS', action: '  ' },
    ],
  })
  expect(out.summary).toBe('You fit well.')
  expect(out.steps).toEqual([{ focus: 'Docker', action: 'Build a small project.' }])
})
