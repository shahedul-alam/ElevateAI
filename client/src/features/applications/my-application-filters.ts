import type { ApplicationStatus } from '@/features/matching/matching.api'
import type { MyApplication } from './applications.api'

export const MY_SORTS = ['newest', 'oldest', 'match'] as const
export type MySort = (typeof MY_SORTS)[number]

export const MY_SORT_LABELS: Record<MySort, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  match: 'Best match',
}

export type MyApplicationFilters = { q: string; status: ApplicationStatus | 'all'; sort: MySort }

export const DEFAULT_MY_FILTERS: MyApplicationFilters = { q: '', status: 'all', sort: 'newest' }

export function filterMyApplications(list: MyApplication[], f: MyApplicationFilters) {
  const q = f.q.trim().toLowerCase()
  const matching = list.filter(
    (a) =>
      (f.status === 'all' || a.status === f.status) &&
      (q === '' ||
        [a.title, a.employerName, a.company?.name, a.location].some((s) => s?.toLowerCase().includes(q))),
  )
  const time = (a: MyApplication) => new Date(a.createdAt).getTime()
  // Copy before sorting: the query cache owns the original array.
  return [...matching].sort((a, b) => {
    if (f.sort === 'match') return b.matchScore - a.matchScore || time(b) - time(a)
    return f.sort === 'oldest' ? time(a) - time(b) : time(b) - time(a)
  })
}

/** Per-status counts for the filter buttons. Ignores the search text so the buttons stay stable. */
export function countMyByStatus(list: MyApplication[]) {
  const counts: Record<string, number> = { all: list.length }
  for (const a of list) counts[a.status] = (counts[a.status] ?? 0) + 1
  return counts
}
