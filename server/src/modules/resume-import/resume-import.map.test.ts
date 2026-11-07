import { expect, test } from 'bun:test'
import { mapExtraction, type AliasLookup } from './resume-import.map'
import type { Extraction } from './resume-import.schema'

const lookup: AliasLookup = {
  skill: new Map([['reactjs', 'skill:react'], ['typescript', 'skill:typescript']]),
  certification: new Map([['awssolutionsarchitect', 'certification:aws-sa']]),
  domain: new Map([['fintech', 'domain:fintech']]),
}
const base: Extraction = { headline: 'Dev', summary: '', skills: [], roles: [], education: [], certifications: [] }
const role = { title: 'Engineer', company: 'X', period: '', description: '', years: 2, domain: 'FinTech' }

test('maps catalog names, sends the rest to unmapped, drops duplicates', () => {
  const out = mapExtraction(
    {
      ...base,
      skills: [
        { name: 'React.js', level: 4, years: 3 },
        { name: 'react js', level: 2, years: 1 },
        { name: 'Cobol', level: 3, years: 2 },
      ],
      certifications: ['AWS Solutions Architect', 'Made-up cert'],
      roles: [role, { ...role, title: ' ', domain: '' }],
    },
    lookup,
  )
  expect(out.skills).toEqual([{ termId: 'skill:react', level: 4, years: 3 }])
  expect(out.certIds).toEqual(['certification:aws-sa'])
  expect(out.unmapped).toEqual(['Cobol', 'Made-up cert'])
  expect(out.roles).toHaveLength(1)
  expect(out.roles[0]!.domainId).toBe('domain:fintech')
  expect(out.leadershipLevel).toBe(0)
})
