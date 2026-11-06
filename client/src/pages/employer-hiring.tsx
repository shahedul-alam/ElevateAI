import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { NativeSelect } from '@/components/native-select'
import { RequireRole } from '@/components/require-role'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApplicantCard } from '@/features/applications/applicant-card'
import { PIPELINE, STATUS_LABEL, type EmployerApplicationFilters } from '@/features/applications/applications.api'
import { useEmployerApplications } from '@/features/applications/use-applications'
import { useMyJobs } from '@/features/jobs/use-jobs'
import type { ApplicationStatus } from '@/features/matching/matching.api'

export default function EmployerHiring() {
  return (
    <RequireRole role="employer" message="Hiring is for employer accounts.">
      <HiringPage />
    </RequireRole>
  )
}

const STATUSES: ApplicationStatus[] = [...PIPELINE, 'rejected']
const KEYS = { status: 'status', jobId: 'job', q: 'q', minRating: 'rating' } as const

const read = (p: URLSearchParams): EmployerApplicationFilters => {
  const status = p.get(KEYS.status) as ApplicationStatus | null
  const rating = p.get(KEYS.minRating)
  return {
    status: status && STATUSES.includes(status) ? status : '',
    jobId: p.get(KEYS.jobId) ?? '',
    q: p.get(KEYS.q) ?? '',
    minRating: rating && /^[1-5]$/.test(rating) ? rating : '',
  }
}

function HiringPage() {
  const [params, setParams] = useSearchParams()
  const jobs = useMyJobs()
  // Search text lives in local state so typing never waits on the router (see /employer/jobs).
  const [search, setSearch] = useState(params.get(KEYS.q) ?? '')
  const filters = { ...read(params), q: search }
  const list = useEmployerApplications(filters)

  const setFilters = (next: Partial<EmployerApplicationFilters>) => {
    // Merge against the live URL so back-to-back changes cannot overwrite each other.
    const merged = { ...read(new URLSearchParams(window.location.search)), ...next }
    const query: Record<string, string> = {}
    for (const [field, key] of Object.entries(KEYS)) {
      const value = merged[field as keyof EmployerApplicationFilters]
      if (value) query[key] = value
    }
    setParams(query, { replace: true })
  }

  const rows = list.data?.pages.flatMap((p) => p.applicants) ?? []
  const counts = list.data?.pages[0]?.counts
  const total = counts ? STATUSES.reduce((sum, s) => sum + counts[s], 0) : 0
  const filtering = filters.status !== '' || filters.jobId !== '' || filters.q !== '' || filters.minRating !== ''

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Hiring</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Every applicant across your jobs, best match first. Ratings and notes are private to you.
      </p>

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_14rem_10rem]">
        <Input
          type="search"
          aria-label="Search applicants by name"
          placeholder="Search by name"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setFilters({ q: e.target.value })
          }}
        />
        <NativeSelect
          aria-label="Filter by job"
          value={filters.jobId}
          onChange={(e) => setFilters({ jobId: e.target.value })}
        >
          <option value="">All jobs</option>
          {jobs.data?.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Minimum rating"
          value={filters.minRating}
          onChange={(e) => setFilters({ minRating: e.target.value })}
        >
          <option value="">Any rating</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={String(n)}>
              {n}+ stars
            </option>
          ))}
        </NativeSelect>
      </div>

      <div role="group" aria-label="Filter by status" className="mb-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={filters.status === '' ? 'default' : 'outline'}
          aria-pressed={filters.status === ''}
          onClick={() => setFilters({ status: '' })}
        >
          All ({total})
        </Button>
        {STATUSES.map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={filters.status === s ? 'default' : 'outline'}
            aria-pressed={filters.status === s}
            onClick={() => setFilters({ status: s })}
          >
            {STATUS_LABEL[s]} ({counts?.[s] ?? 0})
          </Button>
        ))}
      </div>

      {list.isPending ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : list.isError ? (
        <p className="text-sm text-destructive">Could not load applicants.</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center">
          <p className="text-muted-foreground">
            {filtering ? 'No applicants match your filters.' : 'No applications yet.'}
          </p>
          {filtering && (
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
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((a) => (
            <li key={a.id}>
              <ApplicantCard applicant={a} showJob />
            </li>
          ))}
        </ul>
      )}

      {list.hasNextPage && (
        <Button
          variant="outline"
          className="mt-6"
          disabled={list.isFetchingNextPage}
          onClick={() => list.fetchNextPage()}
        >
          {list.isFetchingNextPage ? 'Loading...' : 'Load more'}
        </Button>
      )}
    </main>
  )
}
