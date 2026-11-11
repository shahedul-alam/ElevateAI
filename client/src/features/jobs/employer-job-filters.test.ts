import { expect, test } from 'bun:test'

import {
  DEFAULT_FILTERS,
  SORTS,
  countByStatus,
  filterEmployerJobs,
  oneOf,
  type EmployerJobFilters,
} from './employer-job-filters'
import type { EmployerJobSummary } from './jobs.api'

const job = (id: string, title: string, status: EmployerJobSummary['status'], updatedAt: string) => ({
  id,
  title,
  status,
  publishedAt: null,
  updatedAt,
})

const jobs: EmployerJobSummary[] = [
  job('1', 'Senior Engineer', 'active', '2026-11-03T10:00:00Z'),
  job('2', 'data analyst intern', 'draft', '2026-11-01T10:00:00Z'),
  job('3', 'Machine Learning Engineer', 'active', '2026-11-02T10:00:00Z'),
  job('4', 'DevOps Contractor', 'closed', '2026-10-30T10:00:00Z'),
]

const run = (over: Partial<EmployerJobFilters>) =>
  filterEmployerJobs(jobs, { ...DEFAULT_FILTERS, ...over }).map((j) => j.id)

test('defaults return everything, most recently updated first', () => {
  expect(run({})).toEqual(['1', '3', '2', '4'])
})

test('search matches the title regardless of case and surrounding spaces', () => {
  expect(run({ q: '  ENGINEER ' })).toEqual(['1', '3'])
  expect(run({ q: 'Analyst' })).toEqual(['2'])
  expect(run({ q: 'nothing like this' })).toEqual([])
})

test('status filter narrows the list and combines with search', () => {
  expect(run({ status: 'active' })).toEqual(['1', '3'])
  expect(run({ status: 'closed' })).toEqual(['4'])
  expect(run({ status: 'active', q: 'machine' })).toEqual(['3'])
  expect(run({ status: 'draft', q: 'engineer' })).toEqual([])
})

test('sorts by oldest update and by title ignoring case', () => {
  expect(run({ sort: 'oldest' })).toEqual(['4', '2', '3', '1'])
  expect(run({ sort: 'title' })).toEqual(['2', '4', '3', '1'])
})

test('does not reorder the original array', () => {
  const before = jobs.map((j) => j.id)
  run({ sort: 'title' })
  expect(jobs.map((j) => j.id)).toEqual(before)
})

test('counts per status ignore the search text', () => {
  expect(countByStatus(jobs)).toEqual({ all: 4, draft: 1, active: 2, closed: 1 })
  expect(countByStatus([])).toEqual({ all: 0, draft: 0, active: 0, closed: 0 })
})

test('unknown URL values fall back to the default', () => {
  expect(oneOf(SORTS, 'title', 'updated')).toBe('title')
  expect(oneOf(SORTS, 'bogus', 'updated')).toBe('updated')
  expect(oneOf(SORTS, null, 'updated')).toBe('updated')
})
