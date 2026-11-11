import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { NativeSelect } from '@/components/native-select'
import { RequireRole } from '@/components/require-role'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PIPELINE, STATUS_LABEL, STATUS_STYLE } from '@/features/applications/applications.api'
import { StatusHistory } from '@/features/applications/status-history'
import {
  DEFAULT_MY_FILTERS,
  MY_SORTS,
  MY_SORT_LABELS,
  countMyByStatus,
  filterMyApplications,
  type MyApplicationFilters,
  type MySort,
} from '@/features/applications/my-application-filters'
import { useMyApplications } from '@/features/applications/use-applications'
import { oneOf } from '@/features/jobs/employer-job-filters'
import { JobCard } from '@/features/jobs/job-card'

export default function Applications() {
  return (
    <RequireRole role="candidate" message="Applications are for candidate accounts.">
      <ApplicationsPage />
    </RequireRole>
  )
}

const STATUSES = ['all', ...PIPELINE, 'rejected'] as const

const readFilters = (p: URLSearchParams): MyApplicationFilters => ({
  q: p.get('q') ?? '',
  status: oneOf(STATUSES, p.get('status'), DEFAULT_MY_FILTERS.status),
  sort: oneOf(MY_SORTS, p.get('sort'), DEFAULT_MY_FILTERS.sort),
})

function ApplicationsPage() {
  const applications = useMyApplications()
  const [params, setParams] = useSearchParams()
  // Search text is local state (router updates are transitions and can drop typed characters); the URL mirrors it.
  const [search, setSearch] = useState(params.get('q') ?? '')
  const { status, sort } = readFilters(params)

  const setFilters = (next: Partial<MyApplicationFilters>) => {
    // Merge against the live URL so back-to-back changes do not overwrite each other.
    const merged = { ...readFilters(new URLSearchParams(window.location.search)), ...next }
    const query: Record<string, string> = {}
    if (merged.q) query.q = merged.q
    if (merged.status !== DEFAULT_MY_FILTERS.status) query.status = merged.status
    if (merged.sort !== DEFAULT_MY_FILTERS.sort) query.sort = merged.sort
    setParams(query, { replace: true })
  }

  const all = applications.data?.applications
  const filtered = useMemo(
    () => filterMyApplications(all ?? [], { q: search, status, sort }),
    [all, search, status, sort],
  )
  const counts = countMyByStatus(all ?? [])

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Your applications</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Each score is the one calculated when you applied. Editing your resume later does not change it.
      </p>

      {applications.isPending ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : applications.isError ? (
        <p className="text-sm text-destructive">Could not load your applications.</p>
      ) : applications.data.applications.length === 0 ? (
        <p className="text-muted-foreground">
          You have not applied to any jobs yet.{' '}
          <Link to="/jobs" className="underline">
            Browse jobs
          </Link>
        </p>
      ) : (
        <>
          <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_12rem]">
            <Input
              type="search"
              aria-label="Search your applications"
              placeholder="Search by job, company or location"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setFilters({ q: e.target.value })
              }}
            />
            <NativeSelect
              aria-label="Sort applications"
              value={sort}
              onChange={(e) => setFilters({ sort: e.target.value as MySort })}
            >
              {MY_SORTS.map((o) => (
                <option key={o} value={o}>
                  {MY_SORT_LABELS[o]}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div role="group" aria-label="Filter by status" className="mb-4 flex flex-wrap gap-2">
            {STATUSES.map((st) => (
              <Button
                key={st}
                type="button"
                size="sm"
                variant={status === st ? 'default' : 'outline'}
                aria-pressed={status === st}
                onClick={() => setFilters({ status: st })}
              >
                {st === 'all' ? 'All' : STATUS_LABEL[st]} ({counts[st] ?? 0})
              </Button>
            ))}
          </div>

          <p role="status" aria-live="polite" className="sr-only">
            {filtered.length} {filtered.length === 1 ? 'application' : 'applications'}
          </p>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <p className="text-muted-foreground">No applications match your filters.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setSearch('')
                  setParams({}, { replace: true })
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {filtered.map((a) => (
                <li key={a.id}>
                  <JobCard
                    job={{ ...a, id: a.jobId }}
                    names={applications.data.termNames}
                    score={a.matchScore}
                    linkable={a.jobStatus === 'active'}
                    badge={
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[a.status]}`}>
                        {STATUS_LABEL[a.status]}
                      </span>
                    }
                    footer={`Applied ${new Date(a.createdAt).toLocaleDateString()}${a.jobStatus === 'closed' ? ' · job closed' : ''}`}
                  />
                  <details className="group mt-1 px-1">
                    <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                      <span className="transition-transform group-open:rotate-90" aria-hidden="true">
                        ›
                      </span>
                      Status history
                    </summary>
                    <div className="pb-2 pl-4 pt-1">
                      <StatusHistory history={a.history} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  )
}
