import { Link } from 'react-router'
import { toast } from 'sonner'

import { RequireRole } from '@/components/require-role'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

  const run = (id: string, action: JobAction) => {
    if (action === 'close' && !window.confirm('Close this job? Candidates will no longer be able to apply.'))
      return
    change.mutate(
      { id, action },
      {
        onSuccess: () => toast.success(DONE[action]),
        onError: (err) => toast.error(`Could not ${action} job`, { description: getApiError(err).message }),
      },
    )
  }

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
        <ul className="flex flex-col gap-3">
          {jobs.data.map((job) => (
            <li key={job.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{job.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {STATUS_LABEL[job.status]} · updated {new Date(job.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.status === 'active' && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/jobs/${job.id}`}>View</Link>
                      </Button>
                    )}
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
                        onClick={() => run(job.id, action)}
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
    </main>
  )
}
