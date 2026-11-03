import type { EmployerJobSummary, JobStatus } from './jobs.api'

export const STATUS_FILTERS = ['all', 'draft', 'active', 'closed'] as const
export type StatusFilter = (typeof STATUS_FILTERS)[number]

export const SORTS = ['updated', 'oldest', 'title'] as const
export type JobSort = (typeof SORTS)[number]

export const SORT_LABELS: Record<JobSort, string> = {
  updated: 'Recently updated',
  oldest: 'Oldest updated',
  title: 'Title A to Z',
}

export type EmployerJobFilters = { q: string; status: StatusFilter; sort: JobSort }

export const DEFAULT_FILTERS: EmployerJobFilters = { q: '', status: 'all', sort: 'updated' }

/** Reads a URL value, falling back to the default when it is missing or not one of the options. */
export const oneOf = <T extends string>(options: readonly T[], value: string | null, fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback

export function filterEmployerJobs(jobs: EmployerJobSummary[], filters: EmployerJobFilters) {
  const q = filters.q.trim().toLowerCase()
  const matching = jobs.filter(
    (j) =>
      (filters.status === 'all' || j.status === filters.status) &&
      (q === '' || j.title.toLowerCase().includes(q)),
  )
  const byUpdated = (a: EmployerJobSummary, b: EmployerJobSummary) =>
    new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
  // Copy before sorting: the query cache owns the original array.
  return [...matching].sort((a, b) => {
    if (filters.sort === 'title') return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    return filters.sort === 'oldest' ? byUpdated(a, b) : byUpdated(b, a)
  })
}

/** Counts per status for the filter tabs. Deliberately ignores the search text so tabs stay stable. */
export function countByStatus(jobs: EmployerJobSummary[]): Record<StatusFilter, number> {
  const counts: Record<JobStatus, number> = { draft: 0, active: 0, closed: 0 }
  for (const j of jobs) counts[j.status] += 1
  return { all: jobs.length, ...counts }
}
