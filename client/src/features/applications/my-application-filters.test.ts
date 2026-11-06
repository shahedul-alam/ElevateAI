import { expect, test } from 'bun:test'

import type { MyApplication } from './applications.api'
import { DEFAULT_MY_FILTERS, countMyByStatus, filterMyApplications } from './my-application-filters'

const app = (id: string, title: string, status: MyApplication['status'], matchScore: number, createdAt: string) =>
  ({ id, title, status, matchScore, createdAt, employerName: 'Acme', company: null }) as MyApplication

const list = [
  app('a', 'React Developer', 'applied', 70, '2026-01-01'),
  app('b', 'Data Analyst', 'offer', 90, '2026-02-01'),
  app('c', 'Backend Engineer', 'applied', 80, '2026-03-01'),
]

test('searches title and employer, case-insensitively', () => {
  expect(filterMyApplications(list, { ...DEFAULT_MY_FILTERS, q: 'react' }).map((a) => a.id)).toEqual(['a'])
  expect(filterMyApplications(list, { ...DEFAULT_MY_FILTERS, q: 'ACME' })).toHaveLength(3)
})

test('filters by status and sorts', () => {
  expect(filterMyApplications(list, { ...DEFAULT_MY_FILTERS, status: 'applied' }).map((a) => a.id)).toEqual(['c', 'a'])
  expect(filterMyApplications(list, { ...DEFAULT_MY_FILTERS, sort: 'match' }).map((a) => a.id)).toEqual(['b', 'c', 'a'])
  expect(filterMyApplications(list, { ...DEFAULT_MY_FILTERS, sort: 'oldest' }).map((a) => a.id)).toEqual(['a', 'b', 'c'])
})

test('counts ignore search', () => {
  expect(countMyByStatus(list)).toEqual({ all: 3, applied: 2, offer: 1 })
})
