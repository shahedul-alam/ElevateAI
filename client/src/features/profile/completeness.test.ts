import { expect, test } from 'bun:test'

import { completeness } from './completeness'
import type { CurrentProfile } from './profile.api'
import { emptyContact } from './profile.schema'

const empty = (): CurrentProfile => ({
  id: 'v1',
  createdAt: '2026-01-01T00:00:00.000Z',
  isCurrent: true,
  termNames: {},
  contact: { ...emptyContact },
  content: {
    headline: '',
    summary: '',
    skills: [],
    roles: [],
    education: [],
    leadershipLevel: 0,
    certIds: [],
    unmapped: [],
    preferences: { locations: [], workModes: [] },
  },
})

const full = (): CurrentProfile => {
  const p = empty()
  p.content.headline = 'Frontend engineer'
  p.content.summary = 'Builds web apps.'
  p.content.skills = [{ termId: 'skill:react', level: 4, years: 3 }]
  p.content.roles = [{ title: 'Engineer', years: 3, company: '', period: '', description: '' }]
  p.content.education = [{ degreeLevel: 2, field: '', institution: '', period: '' }]
  p.content.preferences = { locations: [], workModes: ['remote'] }
  p.contact.city = 'Lisbon'
  return p
}

const doneKeys = (r: ReturnType<typeof completeness>) => r.items.filter((i) => i.done).map((i) => i.key)

test('no resume: nothing is done', () => {
  const r = completeness(null, false, false)
  expect(r.percent).toBe(0)
  expect(doneKeys(r)).toEqual([])
})

test('an empty saved resume only counts as saved', () => {
  expect(doneKeys(completeness(empty(), false, false))).toEqual(['resume'])
})

test('a full resume with photo and review is 100%', () => {
  const r = completeness(full(), true, true)
  expect(r.percent).toBe(100)
  expect(r.items.every((i) => i.done)).toBe(true)
})

test('photo and review each flip only their own item', () => {
  const base = doneKeys(completeness(full(), false, false))
  expect(doneKeys(completeness(full(), true, false))).toEqual([...base, 'photo'])
  expect(doneKeys(completeness(full(), false, true))).toEqual([...base, 'review'])
})

test('blank text and a blank-only contact do not count', () => {
  const p = empty()
  p.content.headline = '   '
  p.contact.phone = '  '
  expect(doneKeys(completeness(p, false, false))).toEqual(['resume'])
})

test('each preference counts, including a zero-free minimum salary', () => {
  for (const prefs of [{ locations: ['Lisbon'], workModes: [] }, { locations: [], workModes: ['remote' as const] }, { locations: [], workModes: [], minSalary: 50000 }]) {
    const p = empty()
    p.content.preferences = prefs
    expect(doneKeys(completeness(p, false, false))).toContain('preferences')
  }
})
