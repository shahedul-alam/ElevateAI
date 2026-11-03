import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { NativeSelect } from '@/components/native-select'
import { RequireRole } from '@/components/require-role'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  DEFAULT_FILTERS,
  SORTS,
  SORT_LABELS,
  STATUS_FILTERS,
  countByStatus,
  filterEmployerJobs,
  oneOf,
  type EmployerJobFilters,
  type JobSort,
} from '@/features/jobs/employer-job-filters'
import type { JobAction, JobStatus } from '@/features/jobs/jobs.api'
import { useChangeJobStatus, useMyJobs } from '@/features/jobs/use-jobs'
import { getApiError } from '@/lib/api'

export default function EmployerJobs() {
  return (
    <RequireRole role="employer" message="Posting jobs is for employer accounts.">
      <JobsPage />
    </RequireRole>
  )
}

const STATUS_LABEL: Record<JobStatus, string> = { draft: 'Draft', active: 'Active', closed: 'Closed' }

const ACTIONS: Record<JobStatus, { action: JobAction; label: string }[]> = {
  draft: [{ action: 'publish', label: 'Publish' }],
  active: [
    { action: 'unpublish', label: 'Unpublish' },
    { action: 'close', label: 'Close' },
  ],
  closed: [],
}

const DONE: Record<JobAction, string> = {
  publish: 'Job published',
  unpublish: 'Job moved back to draft',
  close: 'Job closed',
}

function JobsPage() {
  const jobs = useMyJobs()
  const change = useChangeJobStatus()
  const [params, setParams] = useSearchParams()
  const [closing, setClosing] = useState<{ id: string; title: string } | null>(null)

  // The search text lives in local state so typing never waits on the router (its updates are
  // transitions, which can make a URL-controlled input drop characters). The URL still mirrors it.
  const [search, setSearch] = useState(params.get('q') ?? '')
  const filters: EmployerJobFilters = {
    q: search,
    status: oneOf(STATUS_FILTERS, params.get('status'), DEFAULT_FILTERS.status),
    sort: oneOf(SORTS, params.get('sort'), DEFAULT_FILTERS.sort),
  }
  // Defaults are left out of the URL so it stays short; replace keeps Back from stepping through keystrokes.
  const setFilters = (next: Partial<EmployerJobFilters>) => {
    // Merge against the live URL, not this render's copy: back-to-back changes (type, then pick a
    // status, then a sort) would otherwise overwrite each other before the router re-renders.
    const live = new URLSearchParams(window.location.search)
    const current: EmployerJobFilters = {
      q: live.get('q') ?? '',
      status: oneOf(STATUS_FILTERS, live.get('status'), DEFAULT_FILTERS.status),
      sort: oneOf(SORTS, live.get('sort'), DEFAULT_FILTERS.sort),
    }
    const merged = { ...current, ...next }
    const query: Record<string, string> = {}
    if (merged.q) query.q = merged.q
    if (merged.status !== DEFAULT_FILTERS.status) query.status = merged.status
    if (merged.sort !== DEFAULT_FILTERS.sort) query.sort = merged.sort
    setParams(query, { replace: true })
  }
  const filtered = useMemo(
    () => filterEmployerJobs(jobs.data ?? [], { q: filters.q, status: filters.status, sort: filters.sort }),
    [jobs.data, filters.q, filters.status, filters.sort],
  )
  const counts = countByStatus(jobs.data ?? [])
  const filtering = filters.q !== '' || filters.status !== 'all'

  const run = (id: string, action: JobAction) =>
    change.mutate(
      { id, action },
      {
        onSuccess: () => toast.success(DONE[action]),
        onError: (err) => toast.error(`Could not ${action} job`, { description: getApiError(err).message }),
        onSettled: () => setClosing(null),
      },
    )

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Your jobs</h1>
        <Button asChild>
          <Link to="/employer/jobs/new">Post a job</Link>
        </Button>
      </div>

      {jobs.isPending ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : jobs.isError ? (
        <p className="text-sm text-destructive">Could not load your jobs.</p>
      ) : jobs.data.length === 0 ? (
        <p className="text-muted-foreground">You have not posted any jobs yet.</p>
      ) : (
        <>
          <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_12rem]">
            <Input
              type="search"
              aria-label="Search your jobs"
              placeholder="Search by job title"
              value={filters.q}
              onChange={(e) => {
                setSearch(e.target.value)
                setFilters({ q: e.target.value })
              }}
            />
            <NativeSelect
              aria-label="Sort jobs"
              value={filters.sort}
              onChange={(e) => setFilters({ sort: e.target.value as JobSort })}
            >
              {SORTS.map((o) => (
                <option key={o} value={o}>
                  {SORT_LABELS[o]}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div role="group" aria-label="Filter by status" className="mb-4 flex flex-wrap gap-2">
            {STATUS_FILTERS.map((st) => (
              <Button
                key={st}
                type="button"
                size="sm"
                variant={filters.status === st ? 'default' : 'outline'}
                aria-pressed={filters.status === st}
                onClick={() => setFilters({ status: st })}
              >
                {st === 'all' ? 'All' : STATUS_LABEL[st]} ({counts[st]})
              </Button>
            ))}
          </div>

          <p role="status" aria-live="polite" className="sr-only">
            {filtered.length} {filtered.length === 1 ? 'job' : 'jobs'}
          </p>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <p className="text-muted-foreground">No jobs match your filters.</p>
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
              {filtered.map((job) => (
                <li key={job.id}>
                  {/* The title link stretches over the whole card (opens the preview); the buttons sit above it. */}
                  <Card className="relative transition-colors focus-within:ring-2 focus-within:ring-ring/50 hover:bg-accent/40">
                    <CardContent className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to={`/employer/jobs/${job.id}/edit?tab=preview`}
                          className="block truncate font-medium outline-none after:absolute after:inset-0 after:content-['']"
                        >
                          {job.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {STATUS_LABEL[job.status]} · updated {new Date(job.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="relative z-10 flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/employer/jobs/${job.id}/applicants`}>Applicants</Link>
                        </Button>
                        {job.status !== 'closed' && (
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/employer/jobs/${job.id}/edit`}>Edit</Link>
                          </Button>
                        )}
                        {ACTIONS[job.status].map(({ action, label }) => (
                          <Button
                            key={action}
                            variant={action === 'publish' ? 'default' : 'outline'}
                            size="sm"
                            disabled={change.isPending}
                            onClick={() =>
                              action === 'close' ? setClosing({ id: job.id, title: job.title }) : run(job.id, action)
                            }
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ConfirmDialog
        open={closing !== null}
        onOpenChange={(open) => !open && setClosing(null)}
        title={closing ? `Close "${closing.title}"?` : 'Close this job?'}
        description={
          <>
            <p>
              Candidates will no longer be able to apply, and the job disappears from the public list.
            </p>
            <p className="mt-2">
              A closed job cannot be edited or reopened. Existing applications and the applicants list stay
              available.
            </p>
          </>
        }
        confirmLabel="Close job"
        pendingLabel="Closing..."
        pending={change.isPending}
        destructive
        onConfirm={() => closing && run(closing.id, 'close')}
      />
    </main>
  )
}
