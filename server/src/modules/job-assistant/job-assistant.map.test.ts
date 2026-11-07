import { expect, test } from 'bun:test'
import { mapJobDraft } from './job-assistant.map'
import type { DraftOutput } from './job-assistant.schema'

const lookup = new Map([['reactjs', 'skill:react'], ['typescript', 'skill:typescript']])
const base: DraftOutput = {
  title: ' Frontend Engineer ',
  description: ' Build things. ',
  employmentType: '',
  responsibilities: [],
  qualifications: [],
  perks: [],
  otherDetails: [],
  skills: [],
}

test('maps skills by alias, reports the rest, and required wins on repeats', () => {
  const { draft, unmappedSkills } = mapJobDraft(
    {
      ...base,
      skills: [
        { name: 'React.js', required: false },
        { name: 'react js', required: true },
        { name: 'TypeScript', required: false },
        { name: 'Cobol', required: true },
      ],
    },
    lookup,
  )
  expect(draft.skills).toEqual([
    { termId: 'skill:react', required: true },
    { termId: 'skill:typescript', required: false },
  ])
  expect(unmappedSkills).toEqual(['Cobol'])
})

test('tidies text and lists, and treats an empty employment type as unset', () => {
  const long = 'x'.repeat(400)
  const { draft } = mapJobDraft(
    { ...base, responsibilities: [' Ship ', 'Ship', '', long], employmentType: 'contract' },
    lookup,
  )
  expect(draft.title).toBe('Frontend Engineer')
  expect(draft.description).toBe('Build things.')
  expect(draft.responsibilities).toEqual(['Ship', 'x'.repeat(300)])
  expect(draft.employmentType).toBe('contract')
  expect(mapJobDraft(base, lookup).draft.employmentType).toBeUndefined()
})

test('never produces a scored field besides skills', () => {
  const keys = Object.keys(mapJobDraft(base, lookup).draft)
  for (const k of ['minYears', 'domainId', 'minDegreeLevel', 'leadershipLevel', 'certIds', 'salaryMin', 'location']) {
    expect(keys).not.toContain(k)
  }
})
