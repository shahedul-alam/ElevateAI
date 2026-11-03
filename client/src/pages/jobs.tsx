import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { NativeSelect } from '@/components/native-select'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/features/auth/auth.store'
import { searchCatalog } from '@/features/catalog/catalog.api'
import { formatSalary } from '@/features/jobs/format'
import type { JobListFilters } from '@/features/jobs/jobs.api'
import { usePublicJobs } from '@/features/jobs/use-jobs'
import { useRecommended } from '@/features/matching/use-matching'
import { WORK_MODES } from '@/features/profile/profile.schema'
import { getApiError } from '@/lib/api'

const NO_FILTERS: JobListFilters = { q: '', workMode: '', domainId: '' }

export default function Jobs() {
  const [filters, setFilters] = useState<JobListFilters>(NO_FILTERS)
  const [search, setSearch] = useState('')
  const jobs = usePublicJobs(filters)
  const isCandidate = useAuthStore((s) => s.user?.role === 'candidate')
  const recommended = useRecommended(isCandidate)

  const domains = useQuery({
    queryKey: ['catalog', 'domain', 'all'],
    queryFn: () => searchCatalog('domain', '', 50),
    staleTime: 5 * 60_000,
  })

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setFilters((f) => ({ ...f, q: search.trim() }))
  }

  const pages = jobs.data?.pages ?? []
  const cards = pages.flatMap((p) => p.jobs)
  const names = Object.assign({}, ...pages.map((p) => p.termNames)) as Record<string, string>

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Jobs</h1>

      <form onSubmit={onSearch} className="mb-6 grid gap-2 sm:grid-cols-[1fr_10rem_12rem_auto]">
        <Input
          aria-label="Search jobs"
          placeholder="Search title or description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <NativeSelect
          aria-label="Work mode"
          value={filters.workMode}
          onChange={(e) => setFilters((f) => ({ ...f, workMode: e.target.value }))}
        >
          <option value="">Any work mode</option>
          {WORK_MODES.map((m) => (
            <option key={m} value={m}>
              {m[0]!.toUpperCase() + m.slice(1)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Industry"
          value={filters.domainId}
          onChange={(e) => setFilters((f) => ({ ...f, domainId: e.target.value }))}
        >
          <option value="">Any industry</option>
          {(domains.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit">Search</Button>
      </form>

      {isCandidate && <Recommended query={recommended} />}

      {jobs.isPending ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : jobs.isError ? (
        <p className="text-sm text-destructive">Could not load jobs. Try again in a moment.</p>
      ) : cards.length === 0 ? (
        <p className="text-muted-foreground">No jobs match your search.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cards.map((job) => {
            const salary = formatSalary(job.salaryMin, job.salaryMax)
            const meta = [
              job.employerName,
              job.location,
              job.workMode && job.workMode[0]!.toUpperCase() + job.workMode.slice(1),
              job.domainId && names[job.domainId],
              salary,
            ].filter(Boolean)
            return (
              <li key={job.id}>
                <Link to={`/jobs/${job.id}`} className="block rounded-xl focus-visible:outline-2">
                  <Card className="transition-colors hover:bg-accent/40">
                    <CardContent className="flex flex-col gap-2">
                      <p className="font-medium">{job.title}</p>
                      <p className="text-sm text-muted-foreground">{meta.join(' · ')}</p>
                      {job.skillIds.length > 0 && (
                        <ul className="flex flex-wrap gap-2">
                          {job.skillIds.map((id) => (
                            <li key={id} className="rounded-full border px-2.5 py-0.5 text-xs">
                              {names[id] ?? id}
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {jobs.hasNextPage && (
        <Button
          variant="outline"
          className="mt-6"
          disabled={jobs.isFetchingNextPage}
          onClick={() => jobs.fetchNextPage()}
        >
          {jobs.isFetchingNextPage ? 'Loading...' : 'Load more'}
        </Button>
      )}
    </main>
  )
}

function Recommended({ query }: { query: ReturnType<typeof useRecommended> }) {
  const [open, setOpen] = useState(false)

  if (query.isPending) return null
  if (query.isError) {
    // 409 means no resume yet: that is a prompt, not a failure.
    if (getApiError(query.error).status !== 409) return null
  } else if (query.data.jobs.length === 0) {
    return null
  }

  return (
    <div className="mb-6">
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        aria-controls="recommended-panel"
        onClick={() => setOpen((o) => !o)}
      >
        Recommended for you
        <span className="text-xs text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
      </Button>
      {open && (
        <div id="recommended-panel" className="mt-3">
          {query.isError ? (
            <p className="rounded-lg border p-3 text-sm text-muted-foreground">
              <Link to="/resume" className="underline">
                Build your resume
              </Link>{' '}
              to see jobs ranked by how well you match.
            </p>
          ) : (
            <RecommendedList jobs={query.data.jobs} />
          )}
        </div>
      )}
    </div>
  )
}

function RecommendedList({ jobs }: { jobs: NonNullable<ReturnType<typeof useRecommended>['data']>['jobs'] }) {
  return (
    <section aria-labelledby="recommended-heading">
      <h2 id="recommended-heading" className="sr-only">
        Recommended for you
      </h2>
      <ul className="flex flex-col gap-3">
        {jobs.map((job) => (
          <li key={job.id}>
            <Link to={`/jobs/${job.id}`} className="block rounded-xl focus-visible:outline-2">
              <Card className="transition-colors hover:bg-accent/40">
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{job.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {[job.employerName, job.location, formatSalary(job.salaryMin, job.salaryMax)]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <p className="text-lg font-semibold tabular-nums" aria-label={`Match score ${job.score} percent`}>
                    {job.score}%
                  </p>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
